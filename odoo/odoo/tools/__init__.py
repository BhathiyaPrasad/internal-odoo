# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from . import _monkeypatches
from . import _monkeypatches_pytz

from werkzeug import urls
if not hasattr(urls, 'url_join'):
    # see https://github.com/pallets/werkzeug/compare/2.3.0..3.0.0
    # see https://github.com/pallets/werkzeug/blob/2.3.0/src/werkzeug/urls.py for replacement
    from . import _monkeypatches_urls

from . import appdirs
from . import cloc
from . import constants
from . import pdf
from . import pycompat
from . import win32
from .barcode import *
from .config import config
from .date_utils import *
from .float_utils import *
from .func import *
from .i18n import *
from .image import *
from .mail import *
from .misc import *
from .query import Query, _generate_table_alias
from .sql import *
from .template_inheritance import *
from .translate import *
from .xml_utils import *
from .convert import *
from . import osutil
from .js_transpiler import transpile_javascript, is_odoo_module, URL_RE, ODOO_MODULE_RE
from .sourcemap_generator import SourceMapGenerator
from .set_expression import SetDefinitions