# -*- coding: utf-8 -*-

from collections import defaultdict
from datetime import timedelta, datetime, date
import calendar

from odoo import fields, models, api, _, Command
from odoo.exceptions import ValidationError, UserError, RedirectWarning
from odoo.tools import SQL
from odoo.tools.mail import is_html_empty
from odoo.tools.misc import format_date
from odoo.addons.account.models.account_move import MAX_HASH_VERSION


MONTH_SELECTION = [
    ('1', 'January'),
    ('2', 'February'),
    ('3', 'March'),
    ('4', 'April'),
    ('5', 'May'),
    ('6', 'June'),
    ('7', 'July'),
    ('8', 'August'),
    ('9', 'September'),
    ('10', 'October'),
    ('11', 'November'),
    ('12', 'December'),
]

PEPPOL_LIST = [
    'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
    'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'ME',
    'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'SM', 'TR', 'VA',
]

INTEGRITY_HASH_BATCH_SIZE = 1000


class ResCompany(models.Model):
    _name = "res.company"
    _inherit = ["res.company", "mail.thread"]

    #TODO check all the options/fields are in the views (settings + company form view)
    fiscalyear_last_day = fields.Integer(default=31, required=True)
    fiscalyear_last_month = fields.Selection(MONTH_SELECTION, default='12', required=True)
    period_lock_date = fields.Date(
        string="Journals Entries Lock Date",
        tracking=True,
        help="Only users with the 'Adviser' role can edit accounts prior to and inclusive of this"
             " date. Use it for period locking inside an open fiscal year, for example.")
    fiscalyear_lock_date = fields.Date(
        string="All Users Lock Date",
        tracking=True,
        help="No users, including Advisers, can edit accounts prior to and inclusive of this date."
             " Use it for fiscal year locking for example.")
    tax_lock_date = fields.Date(
        string="Tax Return Lock Date",
        tracking=True,
        help="No users can edit journal entries related to a tax prior and inclusive of this date.")
    max_tax_lock_date = fields.Date(compute='_compute_max_tax_lock_date', recursive=True)  # TODO maybe store
    transfer_account_id = fields.Many2one('account.account',
        check_company=True,
        domain="[('reconcile', '=', True), ('account_type', '=', 'asset_current'), ('deprecated', '=', False)]", string="Inter-Banks Transfer Account", help="Intermediary account used when moving money from a liqity account to another")
    expects_chart_of_accounts = fields.Boolean(string='Expects a Chart of Accounts', default=True)
    chart_template = fields.Selection(selection='_chart_template_selection')
    bank_account_code_prefix = fields.Char(string='Prefix of the bank accounts')
    cash_account_code_prefix = fields.Char(string='Prefix of the cash accounts')
    default_cash_difference_income_account_id = fields.Many2one('account.account', string="Cash Difference Income", check_company=True)
    default_cash_difference_expense_account_id = fields.Many2one('account.account', string="Cash Difference Expense", check_company=True)
    account_journal_suspense_account_id = fields.Many2one('account.account', string='Journal Suspense Account', check_company=True)
    account_journal_payment_debit_account_id = fields.Many2one('account.account', string='Journal Outstanding Receipts', check_company=True)
    account_journal_payment_credit_account_id = fields.Many2one('account.account', string='Journal Outstanding Payments', check_company=True)
    account_journal_early_pay_discount_gain_account_id = fields.Many2one(comodel_name='account.account', string='Cash Discount Write-Off Gain Account', check_company=True)
    account_journal_early_pay_discount_loss_account_id = fields.Many2one(comodel_name='account.account', string='Cash Discount Write-Off Loss Account', check_company=True)
    transfer_account_code_prefix = fields.Char(string='Prefix of the transfer accounts')
    account_sale_tax_id = fields.Many2one('account.tax', string="Default Sale Tax", check_company=True)
    account_purchase_tax_id = fields.Many2one('account.tax', string="Default Purchase Tax", check_company=True)
    tax_calculation_rounding_method = fields.Selection([
        ('round_per_line', 'Round per Line'),
        ('round_globally', 'Round Globally'),
        ], default='round_per_line', string='Tax Calculation Rounding Method')
    currency_exchange_journal_id = fields.Many2one('account.journal', string="Exchange Gain or Loss Journal", domain=[('type', '=', 'general')])
    income_currency_exchange_account_id = fields.Many2one(
        comodel_name='account.account',
        string="Gain Exchange Rate Account",
        check_company=True,
        domain="[('deprecated', '=', False),\
                ('account_type', 'in', ('income', 'income_other'))]")
    expense_currency_exchange_account_id = fields.Many2one(
        comodel_name='account.account',
        string="Loss Exchange Rate Account",
        check_company=True,
        domain="[('deprecated', '=', False), \
                ('account_type', '=', 'expense')]")
    anglo_saxon_accounting = fields.Boolean(string="Use anglo-saxon accounting")
    bank_journal_ids = fields.One2many('account.journal', 'company_id', domain=[('type', '=', 'bank')], string='Bank Journals')
    incoterm_id = fields.Many2one('account.incoterms', string='Default incoterm',
        help='International Commercial Terms are a series of predefined commercial terms used in international transactions.')

    qr_code = fields.Boolean(string='Display QR-code on invoices')

    invoice_is_email = fields.Boolean('Email by default', default=True)
    invoice_is_download = fields.Boolean('Download by default', default=True)
    display_invoice_amount_total_words = fields.Boolean(string='Total amount of invoice in letters')
    display_invoice_tax_company_currency = fields.Boolean(
        string="Taxes in company currency",
        default=True,
    )
    account_use_credit_limit = fields.Boolean(
        string='Sales Credit Limit', help='Enable the use of credit limit on partners.')

    #Fields of the setup step for opening move
    account_opening_move_id = fields.Many2one(string='Opening Journal Entry', comodel_name='account.move', help="The journal entry containing the initial balance of all this company's accounts.")
    account_opening_journal_id = fields.Many2one(string='Opening Journal', comodel_name='account.journal', related='account_opening_move_id.journal_id', help="Journal where the opening entry of this company's accounting has been posted.", readonly=False)
    account_opening_date = fields.Date(string='Opening Entry', default=lambda self: fields.Date.context_today(self).replace(month=1, day=1), required=True, help="That is the date of the opening entry.")

    invoice_terms = fields.Html(string='Default Terms and Conditions', translate=True)
    terms_type = fields.Selection([('plain', 'Add a Note'), ('html', 'Add a link to a Web Page')],
                                  string='Terms & Conditions format', default='plain')
    invoice_terms_html = fields.Html(string='Default Terms and Conditions as a Web page', translate=True,
                                     sanitize_attributes=False,
                                     compute='_compute_invoice_terms_html', store=True, readonly=False)

    # Needed in the Point of Sale
    account_default_pos_receivable_account_id = fields.Many2one('account.account', string="Default PoS Receivable Account", check_company=True)

    # Accrual Accounting
    expense_accrual_account_id = fields.Many2one('account.account',
        help="Account used to move the period of an expense",
        check_company=True,
        domain="[('internal_group', '=', 'liability'), ('account_type', 'not in', ('asset_receivable', 'liability_payable'))]")
    revenue_accrual_account_id = fields.Many2one('account.account',
        help="Account used to move the period of a revenue",
        check_company=True,
        domain="[('internal_group', '=', 'asset'), ('account_type', 'not in', ('asset_receivable', 'liability_payable'))]")
    automatic_entry_default_journal_id = fields.Many2one(
        'account.journal',
        domain="[('type', '=', 'general')]",
        check_company=True,
        help="Journal used by default for moving the period of an entry",
    )

    # Taxes
    account_fiscal_country_id = fields.Many2one(
        string="Fiscal Country",
        comodel_name='res.country',
        compute='compute_account_tax_fiscal_country',
        store=True,
        readonly=False,
        help="The country to use the tax reports from for this company")

    account_enabled_tax_country_ids = fields.Many2many(
        string="l10n-used countries",
        comodel_name='res.country',
        compute='_compute_account_enabled_tax_country_ids',
        help="Technical field containing the countries for which this company is using tax-related features"
             "(hence the ones for which l10n modules need to show tax-related fields).")

    # Cash basis taxes
    tax_exigibility = fields.Boolean(string='Use Cash Basis')
    tax_cash_basis_journal_id = fields.Many2one(
        comodel_name='account.journal',
        check_company=True,
        string="Cash Basis Journal")
    account_cash_basis_base_account_id = fields.Many2one(
        comodel_name='account.account',
        check_company=True,
        domain=[('deprecated', '=', False)],
        string="Base Tax Received Account",
        help="Account that will be set on lines created in cash basis journal entry and used to keep track of the "
             "tax base amount.")

    # Storno Accounting
    account_storno = fields.Boolean(string="Storno accounting", readonly=False)

    # Multivat
    fiscal_position_ids = fields.One2many(comodel_name="account.fiscal.position", inverse_name="company_id")
    multi_vat_foreign_country_ids = fields.Many2many(
        string="Foreign VAT countries",
        help="Countries for which the company has a VAT number",
        comodel_name='res.country',
        compute='_compute_multi_vat_foreign_country',
    )

    # Fiduciary mode
    quick_edit_mode = fields.Selection(
        selection=[
            ('out_invoices', 'Customer Invoices'),
            ('in_invoices', 'Vendor Bills'),
            ('out_and_in_invoices', 'Customer Invoices and Vendor Bills')],
        string="Quick encoding")

    # Separate account for allocation of discounts
    account_discount_income_allocation_id = fields.Many2one(comodel_name='account.account', string='Separate account for income discount')
    account_discount_expense_allocation_id = fields.Many2one(comodel_name='account.account', string='Separate account for expense discount')

    def _get_company_root_delegated_field_names(self):
        return super()._get_company_root_delegated_field_names() + [
            'fiscalyear_last_day',
            'fiscalyear_last_month',
            'account_storno',
            'tax_exigibility',
        ]

    @api.constrains('account_opening_move_id', 'fiscalyear_last_day', 'fiscalyear_last_month')
    def _check_fiscalyear_last_day(self):
        # if the user explicitly chooses the 29th of February we allow it:
        # there is no "fiscalyear_last_year" so we do not know his intentions.
        for rec in self:
            if rec.fiscalyear_last_day == 29 and rec.fiscalyear_last_month == '2':
                continue

            if rec.account_opening_date:
                year = rec.account_opening_date.year
            else:
                year = datetime.now().year

            max_day = calendar.monthrange(year, int(rec.fiscalyear_last_month))[1]
            if rec.fiscalyear_last_day > max_day:
                raise ValidationError(_("Invalid fiscal year last day"))

    @api.depends('fiscal_position_ids.foreign_vat')
    def _compute_multi_vat_foreign_country(self):
        company_to_foreign_vat_country = {
            company.id: country_ids
            for company, country_ids in self.env['account.fiscal.position']._read_group(
                domain=[
                    *self.env['account.fiscal.position']._check_company_domain(self),
                    ('foreign_vat', '!=', False),
                ],
                groupby=['company_id'],
                aggregates=['country_id:array_agg'],
            )
        }
        for company in self:
            company.multi_vat_foreign_country_ids = self.env['res.country'].browse(company_to_foreign_vat_country.get(company.id))

    @api.depends('country_id')
    def compute_account_tax_fiscal_country(self):
        for record in self:
            if not record.account_fiscal_country_id:
                record.account_fiscal_country_id = record.country_id

    @api.depends('account_fiscal_country_id')
    def _compute_account_enabled_tax_country_ids(self):
        for record in self:
            if record not in self.env.user.company_ids:
                # can have access to the company form without having access to its content (see base.res_company_rule_erp_manager)
                record.account_enabled_tax_country_ids = False
                continue
            foreign_vat_fpos = self.env['account.fiscal.position'].search([
                *self.env['account.fiscal.position']._check_company_domain(record),
                ('foreign_vat', '!=', False)
            ])
            record.account_enabled_tax_country_ids = foreign_vat_fpos.country_id + record.account_fiscal_country_id

    @api.depends('terms_type')
    def _compute_invoice_terms_html(self):
        for company in self.filtered(lambda company: is_html_empty(company.invoice_terms_html) and company.terms_type == 'html'):
            html = self.env['ir.qweb']._render('account.account_default_terms_and_conditions',
                        {'company_name': company.name, 'company_country': company.country_id.name},
                        raise_if_not_found=False)
            if html:
                company.invoice_terms_html = html

    @api.depends('tax_lock_date', 'parent_id.max_tax_lock_date')
    def _compute_max_tax_lock_date(self):
        for company in self:
            company.max_tax_lock_date = max(company.tax_lock_date or date.min, company.parent_id.sudo().max_tax_lock_date or date.min)

    def _initiate_account_onboardings(self):
        account_onboarding_routes = [
            'account_dashboard',
        ]
        onboardings = self.env['onboarding.onboarding'].sudo().search([('route_name', 'in', account_onboarding_routes)])
        for company in self:
            onboardings.with_company(company)._search_or_create_progress()

    @api.model_create_multi
    def create(self, vals_list):
        companies = super().create(vals_list)
        for company in companies:
            if root_template := company.parent_ids[0].chart_template:
                def try_loading(company=company):
                    self.env['account.chart.template']._load(
                        root_template,
                        company,
                        install_demo=False,
                    )
                self.env.cr.precommit.add(try_loading)
        return companies

    def get_new_account_code(self, current_code, old_prefix, new_prefix):
        digits = len(current_code)
        return new_prefix + current_code.replace(old_prefix, '', 1).lstrip('0').rjust(digits-len(new_prefix), '0')

    def reflect_code_prefix_change(self, old_code, new_code):
        if not old_code or new_code == old_code:
            return
        accounts = self.env['account.account'].search([
            *self.env['account.account']._check_company_domain(self),
            ('code', '=like', old_code + '%'),
            ('account_type', 'in', ('asset_cash', 'liability_credit_card')),
        ], order='code asc')
        for account in accounts:
            account.write({'code': self.get_new_account_code(account.code, old_code, new_code)})

    def _get_fiscalyear_lock_statement_lines_redirect_action(self, unreconciled_statement_lines):
        """ Get the action redirecting to the statement lines that are not already reconciled when setting a fiscal
        year lock date.

        :param unreconciled_statement_lines: The statement lines.
        :return: A dictionary representing a window action.
        """

        action = {
            'name': _("Unreconciled Transactions"),
            'type': 'ir.actions.act_window',
            'res_model': 'account.bank.statement.line',
            'context': {'create': False},
        }
        if len(unreconciled_statement_lines) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': unreconciled_statement_lines.id,
            })
        else:
            action.update({
                'view_mode': 'list,form',
                'domain': [('id', 'in', unreconciled_statement_lines.ids)],
            })
        return action

    def _validate_fiscalyear_lock(self, values):
        if values.get('fiscalyear_lock_date'):

            draft_entries = self.env['account.move'].search([
                ('company_id', 'child_of', self.ids),
                ('state', '=', 'draft'),
                ('date', '<=', values['fiscalyear_lock_date'])])
            if draft_entries:
                error_msg = _('There are still draft entries in the period you want to lock. You should either post or delete them.')
                action_error = {
                    'view_mode': 'tree',
                    'name': _('Draft Entries'),
                    'res_model': 'account.move',
                    'type': 'ir.actions.act_window',
                    'domain': [('id', 'in', draft_entries.ids)],
                    'search_view_id': [self.env.ref('account.view_account_move_filter').id, 'search'],
                    'views': [[self.env.ref('account.view_move_tree').id, 'list'], [self.env.ref('account.view_move_form').id, 'form']],
                }
                raise RedirectWarning(error_msg, action_error, _('Show draft entries'))

            unreconciled_statement_lines = self.env['account.bank.statement.line'].search([
                ('company_id', 'child_of', self.ids),
                ('is_reconciled', '=', False),
                ('date', '<=', values['fiscalyear_lock_date']),
                ('move_id.state', 'in', ('draft', 'posted')),
            ])
            if unreconciled_statement_lines:
                error_msg = _("There are still unreconciled bank statement lines in the period you want to lock."
                            "You should either reconcile or delete them.")
                action_error = self._get_fiscalyear_lock_statement_lines_redirect_action(unreconciled_statement_lines)
                raise RedirectWarning(error_msg, action_error, _('Show Unreconciled Bank Statement Line'))

            # Check if there are still unhashed journal entries
            # Only check journals that have at least one hashed entry.
            journals_to_check = self.env['account.journal']
            for journal in self.env['account.journal'].search([
                ('restrict_mode_hash_table', '=', True),
            ]):
                if self.env['account.move'].search_count([
                    ('inalterable_hash', '!=', False),
                    ('journal_id', '=', journal.id),
                ], limit=1):
                    journals_to_check |= journal

            chains_to_hash = self.env['account.move'].search([
                ('restrict_mode_hash_table', '=', True),
                ('inalterable_hash', '=', False),
                ('journal_id', 'in', journals_to_check.ids),
                ('date', '<=', values['fiscalyear_lock_date']),
            ])._get_chains_to_hash(force_hash=True, raise_if_no_document=False)
            move_ids = [move.id for chain in chains_to_hash for move in chain['moves']]
            if move_ids:
                msg = _("Some journal entries have not been hashed yet. You should hash them before locking the fiscal year.")
                action = {
                    'type': 'ir.actions.act_window',
                    'name': _('Journal Entries to Hash'),
                    'res_model': 'account.move',
                    'domain': [('id', 'in', move_ids)],
                    'views': [(False, 'tree'), (False, 'form')],
                }
                if len(move_ids) == 1:
                    action.update({
                        'res_id': move_ids[0],
                        'views': [(False, 'form')],
                    })
                raise RedirectWarning(msg, action, _('Show Journal Entries to Hash'))

    def _get_user_fiscal_lock_date(self):
        """Get the fiscal lock date for this company depending on the user"""
        lock_date = max(self.period_lock_date or date.min, self.fiscalyear_lock_date or date.min)
        if self.env.user.has_group('account.group_account_manager'):
            lock_date = self.fiscalyear_lock_date or date.min
        if self.parent_id:
            # We need to use sudo, since we might not have access to a parent company.
            lock_date = max(lock_date, self.sudo().parent_id._get_user_fiscal_lock_date())
        return lock_date

    def _get_violated_lock_dates(self, accounting_date, has_tax):
        """Get all the lock dates affecting the current accounting_date.
        :param accoutiaccounting_dateng_date: The accounting date
        :param has_tax: If any taxes are involved in the lines of the invoice
        :return: a list of tuples containing the lock dates ordered chronologically.
        """
        self.ensure_one()
        locks = []
        user_lock_date = self._get_user_fiscal_lock_date()
        if accounting_date and user_lock_date and accounting_date <= user_lock_date:
            locks.append((user_lock_date, _('user')))
        tax_lock_date = self.max_tax_lock_date
        if accounting_date and tax_lock_date and has_tax and accounting_date <= tax_lock_date:
            locks.append((tax_lock_date, _('tax')))
        locks.sort()
        return locks

    def write(self, values):
        #restrict the closing of FY if there are still unposted entries
        self._validate_fiscalyear_lock(values)

        # Reflect the change on accounts
        for company in self:
            if values.get('bank_account_code_prefix'):
                new_bank_code = values.get('bank_account_code_prefix') or company.bank_account_code_prefix
                company.reflect_code_prefix_change(company.bank_account_code_prefix, new_bank_code)

            if values.get('cash_account_code_prefix'):
                new_cash_code = values.get('cash_account_code_prefix') or company.cash_account_code_prefix
                company.reflect_code_prefix_change(company.cash_account_code_prefix, new_cash_code)

            #forbid the change of currency_id if there are already some accounting entries existing
            if 'currency_id' in values and values['currency_id'] != company.currency_id.id:
                if company.root_id._existing_accounting():
                    raise UserError(_('You cannot change the currency of the company since some journal items already exist'))

        return super(ResCompany, self).write(values)

    @api.model
    def setting_init_bank_account_action(self):
        """ Called by the 'Bank Accounts' button of the setup bar or from the Financial configuration menu."""
        view_id = self.env.ref('account.setup_bank_account_wizard').id
        context = {'dialog_size': 'medium', **self.env.context}
        return {
            'type': 'ir.actions.act_window',
            'name': _('Setup Bank Account'),
            'res_model': 'account.setup.bank.manual.config',
            'target': 'new',
            'view_mode': 'form',
            'views': [[view_id, 'form']],
            'context': context,
        }

    @api.model
    def _get_default_opening_move_values(self):
        """ Get the default values to create the opening move.

        :return: A dictionary to be passed to account.move.create.
        """
        self.ensure_one()
        default_journal = self.env['account.journal'].search(
            domain=[
                *self.env['account.journal']._check_company_domain(self),
                ('type', '=', 'general'),
            ],
            limit=1,
        )

        if not default_journal:
            raise UserError(_("Please install a chart of accounts or create a miscellaneous journal before proceeding."))

        return {
            'ref': _('Opening Journal Entry'),
            'company_id': self.id,
            'journal_id': default_journal.id,
            'date': self.account_opening_date - timedelta(days=1),
        }

    def opening_move_posted(self):
        """ Returns true if this company has an opening account move and this move is posted."""
        return bool(self.account_opening_move_id) and self.account_opening_move_id.state == 'posted'

    def get_unaffected_earnings_account(self):
        """ Returns the unaffected earnings account for this company, creating one
        if none has yet been defined.
        """
        unaffected_earnings_type = "equity_unaffected"
        account = self.env['account.account'].search([
            *self.env['account.account']._check_company_domain(self),
            ('account_type', '=', unaffected_earnings_type),
        ])
        if account:
            return account[0]
        # Do not assume '999999' doesn't exist since the user might have created such an account
        # manually.
        code = 999999
        while self.env['account.account'].search([
            *self.env['account.account']._check_company_domain(self),
            ('code', '=', str(code)),
        ]):
            code -= 1
        return self.env['account.account']._load_records([
            {
                'xml_id': f"account.{str(self.id)}_unaffected_earnings_account",
                'values': {
                              'code': str(code),
                              'name': _('Undistributed Profits/Losses'),
                              'account_type': unaffected_earnings_type,
                              'company_id': self.id,
                          },
                'noupdate': True,
            }
        ])

    def _update_opening_move(self, to_update):
        """ Create or update the opening move for the accounts passed as parameter.

        :param to_update:   A dictionary mapping each account with a tuple (debit, credit).
                            A separated opening line is created for both fields. A None value on debit/credit means the corresponding
                            line will not be updated.
        """
        self.ensure_one()

        # Don't allow to modify the opening move if not in draft.
        opening_move = self.account_opening_move_id
        if opening_move and opening_move.state != 'draft':
            raise UserError(_(
                'You cannot import the "openning_balance" if the opening move (%s) is already posted. \
                If you are absolutely sure you want to modify the opening balance of your accounts, reset the move to draft.',
                self.account_opening_move_id.name,
            ))

        def del_lines(lines):
            nonlocal open_balance
            for line in lines:
                open_balance -= line.balance
                yield Command.delete(line.id)

        def update_vals(account, side, balance, balancing=False):
            nonlocal open_balance
            corresponding_lines = corresponding_lines_per_account[(account, side)]
            currency = account.currency_id or self.currency_id
            amount_currency = balance if balancing else self.currency_id._convert(balance, currency, date=conversion_date)
            open_balance += balance
            if self.currency_id.is_zero(balance):
                yield from del_lines(corresponding_lines)
            elif corresponding_lines:
                line_to_update = corresponding_lines[0]
                open_balance -= line_to_update.balance
                yield Command.update(line_to_update.id, {
                    'balance': balance,
                    'amount_currency': amount_currency,
                })
                yield from del_lines(corresponding_lines[1:])
            else:
                yield Command.create({
                    'name':_("Automatic Balancing Line") if balancing else _("Opening balance"),
                    'account_id': account.id,
                    'balance': balance,
                    'amount_currency': amount_currency,
                    'currency_id': currency.id,
                })

        # Decode the existing opening move.
        corresponding_lines_per_account = defaultdict(lambda: self.env['account.move.line'])
        corresponding_lines_per_account.update(opening_move.line_ids.grouped(lambda line: (
            line.account_id,
            'debit' if line.balance > 0.0 or line.amount_currency > 0.0 else 'credit',
        )))

        # Update the opening move's lines.
        balancing_account = self.get_unaffected_earnings_account()
        open_balance = (
            sum(corresponding_lines_per_account[(balancing_account, 'credit')].mapped('credit'))
            -sum(corresponding_lines_per_account[(balancing_account, 'debit')].mapped('debit'))
        )
        commands = []
        move_values = {'line_ids': commands}
        if opening_move:
            conversion_date = opening_move.date
        else:
            move_values.update(self._get_default_opening_move_values())
            conversion_date = move_values['date']
        for account, (debit, credit) in to_update.items():
            if debit is not None:
                commands.extend(update_vals(account, 'debit', debit))
            if credit is not None:
                commands.extend(update_vals(account, 'credit', -credit))

        commands.extend(update_vals(balancing_account, 'debit', max(-open_balance, 0), balancing=True))
        commands.extend(update_vals(balancing_account, 'credit', -max(open_balance, 0), balancing=True))

        # Nothing to do.
        if not commands:
            return

        if opening_move:
            opening_move.write(move_values)
        else:
            self.account_opening_move_id = self.env['account.move'].create(move_values)

    def action_save_onboarding_sale_tax(self):
        """ Set the onboarding step as done """
        self.env['onboarding.onboarding.step'].action_validate_step('account.onboarding_onboarding_step_sales_tax')

    def action_save_onboarding_company_data(self):
        self.ensure_one()
        if self.street:
            ref = 'account.onboarding_onboarding_step_company_data'
            self.env['onboarding.onboarding.step'].with_company(self).action_validate_step(ref)
        return {'type': 'ir.actions.client', 'tag': 'soft_reload'}

    def get_chart_of_accounts_or_fail(self):
        account = self.env['account.account'].search(self.env['account.account']._check_company_domain(self), limit=1)
        if len(account) == 0:
            action = self.env.ref('account.action_account_config')
            msg = _(
                "We cannot find a chart of accounts for this company, you should configure it. \n"
                "Please go to Account Configuration and select or install a fiscal localization.")
            raise RedirectWarning(msg, action.id, _("Go to the configuration panel"))
        return account

    def install_l10n_modules(self):
        if res := super().install_l10n_modules():
            self.env.flush_all()
            self.env.reset()     # clear the set of environments
            env = self.env()     # get an environment that refers to the new registry
            for company in self.filtered(lambda c: c.country_id and not c.chart_template):
                template_code = self.env['account.chart.template']._guess_chart_template(company.country_id)
                if template_code != 'generic_coa':
                    @self.env.cr.precommit.add
                    def try_loading(template_code=template_code, company=company):
                        env['account.chart.template'].try_loading(
                            template_code,
                            env['res.company'].browse(company.id),
                        )
        return res

    def _existing_accounting(self) -> bool:
        """Return True iff some accounting entries have already been made for the current company."""
        self.ensure_one()
        return bool(self.env['account.move.line'].search([('company_id', 'child_of', self.id)], limit=1))

    def _chart_template_selection(self):
        return self.env['account.chart.template']._select_chart_template(self.country_id)

    @api.model
    def _action_check_hash_integrity(self):
        return self.env.ref('account.action_report_account_hash_integrity').report_action(self.id)

    def _check_hash_integrity(self):
        """Checks that all posted moves have still the same data as when they were posted
        and raises an error with the result.
        """
        if not self.env.user.has_group('account.group_account_user'):
            raise UserError(_('Please contact your accountant to print the Hash integrity result.'))

        journals = self.env['account.journal'].search(self.env['account.journal']._check_company_domain(self))
        results = []

        for journal in journals:
            if not journal.restrict_mode_hash_table:
                results.append({
                    'journal_name': journal.name,
                    'restricted_by_hash_table': 'X',
                    'status': 'not_restricted',
                    'msg_cover': _('This journal is not restricted'),
                })
                continue

            # We need the `sudo()` to ensure that all the moves are searched, no matter the user's access rights.
            # This is required in order to generate consistent hashes.
            # It is not an issue, since the data is only used to compute a hash and not to return the actual values.
            query = self.env['account.move'].sudo()._search(
                domain=[
                    ('journal_id', '=', journal.id),
                    ('inalterable_hash', '!=', False),
                ],
                order="secure_sequence_number ASC NULLS LAST, sequence_prefix, sequence_number ASC",
            )
            prefix2result = defaultdict(lambda: {
                'first_move': self.env['account.move'],
                'last_move': self.env['account.move'],
                'corrupted_move': self.env['account.move'],
            })
            last_move = self.env['account.move']
            self.env.execute_query(SQL("DECLARE hashed_moves CURSOR FOR %s", query.select()))
            while move_ids := self.env.execute_query(SQL("FETCH %s FROM hashed_moves", INTEGRITY_HASH_BATCH_SIZE)):
                self.env.invalidate_all()
                moves = self.env['account.move'].browse(move_id[0] for move_id in move_ids)
                if not moves and not last_move:
                    results.append({
                        'journal_name': journal.name,
                        'restricted_by_hash_table': 'V',
                        'status': 'no_data',
                        'msg_cover': _('There is no journal entry flagged for accounting data inalterability yet.'),
                    })
                    continue

                current_hash_version = 1
                for move in moves:
                    prefix_result = prefix2result[move.sequence_prefix]
                    if prefix_result['corrupted_move']:
                        continue
                    previous_move = prefix_result['last_move'] if not move.secure_sequence_number else last_move
                    previous_hash = previous_move.inalterable_hash or ""
                    computed_hash = move.with_context(hash_version=current_hash_version)._calculate_hashes(previous_hash)[move]
                    while move.inalterable_hash != computed_hash and current_hash_version < MAX_HASH_VERSION:
                        current_hash_version += 1
                        computed_hash = move.with_context(hash_version=current_hash_version)._calculate_hashes(previous_hash)[move]
                    if move.inalterable_hash != computed_hash:
                        prefix_result['corrupted_move'] = move
                        continue
                    if not prefix_result['first_move']:
                        prefix_result['first_move'] = move
                    prefix_result['last_move'] = move
                    last_move = move

            self.env.execute_query(SQL("CLOSE hashed_moves"))

            for prefix, prefix_result in prefix2result.items():
                if corrupted_move := prefix_result['corrupted_move']:
                    results.append({
                        'restricted_by_hash_table': 'V',
                        'journal_name': f"{journal.name} ({prefix}...)",
                        'status': 'corrupted',
                        'msg_cover': _(
                            "Corrupted data on journal entry with id %(id)s (%(name)s).",
                            id=corrupted_move.id,
                            name=corrupted_move.name,
                        ),
                    })
                else:
                    results.append({
                        'restricted_by_hash_table': 'V',
                        'journal_name': f"{journal.name} ({prefix}...)",
                        'status': 'verified',
                        'msg_cover': _("Entries are correctly hashed"),
                        'first_move_name': prefix_result['first_move'].name,
                        'first_hash': prefix_result['first_move'].inalterable_hash,
                        'first_move_date': format_date(self.env, prefix_result['first_move'].date),
                        'last_move_name': prefix_result['last_move'].name,
                        'last_hash': prefix_result['last_move'].inalterable_hash,
                        'last_move_date': format_date(self.env, prefix_result['last_move'].date),
                    })

        return {
            'results': results,
            'printing_date': format_date(self.env, fields.Date.context_today(self)),
        }

    @api.model
    def _with_locked_records(self, records):
        """ To avoid sending the same records multiple times from different transactions,
        we use this generic method to lock the records passed as parameter.

        :param records: The records to lock.
        """
        self._cr.execute(f'SELECT * FROM {records._table} WHERE id IN %s FOR UPDATE SKIP LOCKED', [tuple(records.ids)])
        available_ids = {r[0] for r in self._cr.fetchall()}
        if available_ids != set(records.ids):
            raise UserError(_("Some documents are being sent by another process already."))

    def compute_fiscalyear_dates(self, current_date):
        """
        The role of this method is to provide a fallback when account_accounting is not installed.
        As the fiscal year is irrelevant when account_accounting is not installed, this method returns the calendar year.
        :param current_date: A datetime.date/datetime.datetime object.
        :return: A dictionary containing:
            * date_from
            * date_to
        """

        return {'date_from': datetime(year=current_date.year, month=1, day=1).date(),
                'date_to': datetime(year=current_date.year, month=12, day=31).date()}
