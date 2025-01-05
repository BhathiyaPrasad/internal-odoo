/** @odoo-module */

import wTourUtils from '@website/js/tours/tour_utils';
import { boundariesIn, setSelection } from '@web_editor/js/editor/odoo-editor/src/utils/utils';

const clickOnImgStep = {
    content: "Click somewhere else to save.",
    trigger: ':iframe #wrap .s_text_image img',
    run: "click",
};

wTourUtils.registerWebsitePreviewTour('link_tools', {
    test: true,
    url: '/',
    edition: true,
}, () => [
    // 1. Create a new link from scratch.
    wTourUtils.dragNDrop({
        id: 's_text_image',
        name: 'Text - Image',
    }),
    {
        content: "Replace first paragraph, to insert a new link",
        trigger: ':iframe #wrap .s_text_image p',
        run: 'editor Go to odoo: ',
    },
    {
        content: "Open link tools",
        trigger: "#toolbar:not(.oe-floating) #create-link",
        run: "click",
    },
    {
        content: "Type the link URL odoo.com",
        trigger: '#toolbar:not(.oe-floating) #o_link_dialog_url_input',
        run: 'edit odoo.com',
    },
    clickOnImgStep,
    // Remove the link.
    {
        content: "Click on the newly created link",
        trigger: ':iframe #wrap .s_text_image a[href="http://odoo.com"]:contains("odoo.com")',
    },
    {
        content: "Remove the link.",
        trigger: ':iframe .popover:contains("http://odoo.com") a .fa-chain-broken',
    },
    {
        content: "Check that the link was removed",
        trigger: ':iframe #wrap .s_text_image p:contains("Go to odoo:"):not(:has(a))',
        run: () => {}, // It's a check.
    },
    // Recreate the link.
    {
        content: "Select first paragraph, to insert a new link",
        trigger: ':iframe #wrap .s_text_image p',
    },
    {
        content: "Open link tools",
        trigger: "#toolbar #create-link",
    },
    {
        content: "Type the link URL odoo.com",
        trigger: '#o_link_dialog_url_input',
        run: 'edit odoo.com'
    },
    clickOnImgStep,
    // 2. Edit the link with the link tools.
    {
        content: "Click on the newly created link",
        trigger: ':iframe .s_text_image a[href="http://odoo.com"]:contains("odoo.com")',
        run: "click",
    },
    {
        content: "Change content (editing the label input) to odoo website_2",
        trigger: '#o_link_dialog_label_input:value(odoo.com)',
        run: 'edit odoo website_2',
    },
    {
        content: "Click again on the link",
        trigger: ':iframe .s_text_image a[href="http://odoo.com"]:contains("odoo website_2")',
        run: "click",
    },
    {
        content: "Change content (editing the DOM) to odoo website",
        trigger: ':iframe .s_text_image a[href="http://odoo.com"]:contains("odoo website_2")',
        run: 'editor odoo website',
    },
    clickOnImgStep,
    {
        content: "Click again on the link",
        trigger: ':iframe .s_text_image a[href="http://odoo.com"]:contains("odoo website")',
        run: "click",
    },
    {
        content: "Check that the label input contains the new content",
        trigger: '#o_link_dialog_label_input:value(odoo website)',
        isCheck: true,
    },
    {
        content: "Link tools, should be open, change the url",
        trigger: '#o_link_dialog_url_input',
        run: "edit odoo.be && click body",
    },

    ...wTourUtils.clickOnSave(),
    // 3. Edit a link after saving the page.
    ...wTourUtils.clickOnEditAndWaitEditMode(),
    {
        content: "The new link content should be odoo website and url odoo.be",
        trigger: ':iframe .s_text_image a[href="http://odoo.be"]:contains("odoo website")',
        run: "click",
    },
    {
        content: "The new link content should be odoo website and url odoo.be",
        trigger: '#toolbar:not(.oe-floating) .dropdown:has([name="link_style_color"]) > button',
        run: "click",
    },
    {
        content: "Click on the secondary style button.",
        trigger: '#toolbar:not(.oe-floating) we-button[data-value="secondary"]',
        run: "click",
    },
    ...wTourUtils.clickOnSave(),
    {
        content: "The link should have the secondary button style.",
        trigger: ':iframe .s_text_image a.btn.btn-secondary[href="http://odoo.be"]:contains("odoo website")',
        isCheck: true,
    },
    // 4. Add link on image.
    ...wTourUtils.clickOnEditAndWaitEditMode(),
    wTourUtils.dragNDrop({
        id: 's_three_columns',
        name: 'Columns',
    }),
    {
        content: "Click on the first image.",
        trigger: ':iframe .s_three_columns .row > :nth-child(1) img',
        run: "click",
    },
    {
        content: "Activate link.",
        trigger: '.o_we_customize_panel we-row:contains("Media") we-button.fa-link',
        run: "click",
    },
    {
        content: "Set URL.",
        trigger: '.o_we_customize_panel we-input:contains("Your URL") input',
        // TODO: remove && click 
        run: "edit odoo.com && click(we-title:contains(Your URL))",
    },
    {
        content: "Deselect image.",
        trigger: ':iframe .s_three_columns .row > :nth-child(2) img',
        run: "click",
    },
    {
        content: "Re-select image.",
        trigger: ':iframe .s_three_columns .row > :nth-child(1) img',
        run: "click",
    },
    {
        content: "Check that the second image is not within a link.",
        trigger: ':iframe .s_three_columns .row > :nth-child(2) div > img',
        isCheck: true,
    },
    {
        content: "Check that link tools appear.",
        trigger: ':iframe .popover div a:contains("http://odoo.com")',
        isCheck: true,
    },
    ...wTourUtils.clickOnSave(),
    {
        content: "Check that the first image was saved.",
        trigger: ':iframe .s_three_columns .row > :nth-child(1) div > a > img',
        run: () => {}, // It's a check.
    },
    {
        content: "Check that the second image was saved.",
        trigger: ':iframe .s_three_columns .row > :nth-child(2) div > img',
        run: () => {}, // It's a check.
    },
    // 5. Remove link from image.
    ...wTourUtils.clickOnEditAndWaitEditMode(),
    {
        content: "Reselect the first image.",
        trigger: ':iframe .s_three_columns .row > :nth-child(1) div > a > img',
    },
    {
        content: "Check that link tools appear.",
        trigger: ':iframe .popover div a:contains("http://odoo.com")',
        run: () => {}, // It's a check.
    },
    {
        content: "Remove link.",
        trigger: ':iframe .popover:contains("http://odoo.com") a .fa-chain-broken',
        run: "click",
    },
    {
        content: "Check that image is not within a link anymore.",
        trigger: ':iframe .s_three_columns .row > :nth-child(1) div > img',
        isCheck: true,
    },
    // 6. Add mega menu with Cards template and edit URL on text-selected card.
    wTourUtils.clickOnElement("menu link", ":iframe header .nav-item a"),
    wTourUtils.clickOnElement("'Edit menu' icon", ":iframe .o_edit_menu_popover .fa-sitemap"),
    {
        content: "Click on 'Add Mega Menu Item' link",
        extra_trigger: '.o_website_dialog:visible',
        trigger: ".modal-body a:contains('Add Mega Menu Item')",
        run: "click",
    },
    {
        content: "Enter mega menu name",
        trigger: ".modal-body input",
        run: "edit Mega",
    },
    wTourUtils.clickOnElement("OK button", ".btn-primary"),
    {
        content: "Drag Mega at the top",
        trigger: '.oe_menu_editor li:contains("Mega") .fa-bars',
        async run(helpers) {
            await helpers.drag_and_drop(".oe_menu_editor li:contains('Home') .fa-bars", {
                position : {
                    top: 20,
                }, 
                relative: true,
            });
        },
    },
    {
        content: "Wait for drop",
        trigger: '.oe_menu_editor:first-child:contains("Mega")',
        isCheck: true,
    },
    wTourUtils.clickOnElement("Save button", ".btn-primary:contains('Save')"),
    wTourUtils.clickOnElement("mega menu", ":iframe header .o_mega_menu_toggle"),
    wTourUtils.changeOption("MegaMenuLayout", "we-toggler"),
    wTourUtils.changeOption("MegaMenuLayout", '[data-select-label="Cards"]'),
    wTourUtils.clickOnElement("card's text", ":iframe header .s_mega_menu_cards p"),
    {
        content: "Enter an URL",
        trigger: "#o_link_dialog_url_input",
        run: "edit https://www.odoo.com",
    },
    {
        content: "Check nothing is lost",
        trigger: ":iframe header .s_mega_menu_cards a[href='https://www.odoo.com']:has(img):has(h4):has(p)",
        isCheck: true,
    },
    // 7. Create new a link from a URL-like text.
    // TODO: the two following steps should be removed.
    // Note that human couldn't replace text hidden by the mega menu.
    {
        content: "click on Mega menu item to hide Mega menu content",
        trigger: `:iframe a[role="menuitem"]:contains(Mega)`,
        run: "click",
    },
    {
        content: "Be sure that mega menu is hidden",
        trigger: `:iframe #wrapwrap:not(div[data-name="Mega Menu"])`,
        isCheck: true,
    },
    {
        content: "Replace first paragraph, write a URL",
        trigger: ':iframe #wrap .s_text_image p',
        run: "editor odoo.com",
    },
    {
        content: "Select text",
        trigger: ':iframe #wrap .s_text_image p:contains(odoo.com)',
        run() {
            setSelection(...boundariesIn(this.anchor), false);
        }
    },
    {
        content: "Open link tools",
        trigger: "#toolbar #create-link",
        run: "click",
    },
    clickOnImgStep,
    {
        // URL transformation into link should persist, without the need for
        // input at input[name=url]
        content: "Check that link was created",
        trigger: ":iframe .s_text_image p a[href='http://odoo.com']:contains('odoo.com')",
        isCheck: true,
    },
    {
        content: "Click on link to open the link tools",
        trigger: ":iframe .s_text_image p a[href='http://odoo.com']",
        run: "click",
    },
    // 8. Check that http links are not coerced to https and vice-versa.
    {
        content: "Change URL to https",
        trigger: "#o_link_dialog_url_input",
        run(helpers) {
            // TODO: update the tour to use helpers.edit("https://odoo.com")
            // To see what happens with edit, add `pause:true` to the previous step 
            // and type yourself https://odoo.com in #o_link_dialog_url_input  
            // The label will be ohttps://
            this.anchor.value = "https://odoo.com";
            this.anchor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }
    },
    {
        content: "Check that link was updated",
        trigger: ":iframe .s_text_image p a[href='https://odoo.com']:contains('odoo.com')",
        isCheck: true,
    },
    {
        content: "Change it back http",
        trigger: "#o_link_dialog_url_input",
        extra_trigger: "div#oe_snippets:not(div.o_we_ui_loading)",
        run(helpers) {
            // TODO: update the tour to use helpers.edit("http://odoo.com")
            this.anchor.value = "http://odoo.com";
            this.anchor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }
    },
    {
        content: "Check that link was updated",
        trigger: ":iframe .s_text_image p a[href='http://odoo.com']:contains('odoo.com')",
        isCheck: true,
    },
    // 9. Test conversion between http and mailto links.
    {
        content: "Change URL into an email address",
        trigger: "#o_link_dialog_url_input",
        extra_trigger: "div#oe_snippets:not(div.o_we_ui_loading)",
        run: "edit callme@maybe.com",
    },
    {
        content: "Check that link was updated and link content is synced with URL",
        trigger: ":iframe .s_text_image p a[href='mailto:callme@maybe.com']:contains('callme@maybe.com')",
        isCheck: true,
    },
    {
        content: "Change URL back into a http one",
        trigger: "#o_link_dialog_url_input",
        // TODO: remove && click
        extra_trigger: "div#oe_snippets:not(div.o_we_ui_loading)",
        run: "edit callmemaybe.com && click body",
    },
    {
        content: "Check that link was updated and link content is synced with URL",
        trigger: ":iframe .s_text_image p a[href='http://callmemaybe.com']:contains('callmemaybe.com')",
        isCheck: true,
    },
    // 10. Test that UI stays up-to-date.
    // TODO this step which was added by https://github.com/odoo/odoo/commit/9fc283b514d420fdfd66123845d9ec3563572692
    // for no apparent reason (the X-original-commit of that one does not add
    // this step) is not required for the test to work (it passes more often
    // without this step than with it). It is a cause of race condition (last
    // check: 31 over 162 tries failed on this). It however makes sense: the
    // popover should indeed be shown and stay shown at this point. To be
    // reenabled once the related feature is robust.
    /*
    {
        content: "Popover should be shown",
        trigger: ":iframe .o_edit_menu_popover .o_we_url_link:contains('http://callmemaybe.com')",
        isCheck: true,
    },
    */
    {
        content: "Edit link label",
        trigger: ":iframe .s_text_image p a",
        run(actions) {
            // TODO: use run: "click", instead
            this.anchor.click();
            // See SHOPS_STEP_DISABLED. TODO. These steps do not consistently
            // update the link for some reason... to investigate.
            /*
            // Simulating text input.
            const link = this.anchor;
            actions.text("callmemaybe.com/shops");
            // Trick the editor into keyboardType === 'PHYSICAL' and delete the
            // last character "s" and end with "callmemaybe.com/shop"
            link.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
            // Trigger editor's '_onInput' handler, which leads to a history step.
            link.dispatchEvent(new InputEvent('input', {inputType: 'insertText', bubbles: true}));
            */
        },
    },
    // See SHOPS_STEP_DISABLED. TODO.
    /*
    {
        content: "Check that links's href was updated",
        trigger: ":iframe .s_text_image p a[href='http://callmemaybe.com/shop']:contains('callmemaybe.com/shop')",
        isCheck: true,
    },
    */
    // TODO this step is disabled for now because it is a cause of race
    // condition (last check: 57 over 162 tries failed on this). The popover
    // seems to sometimes unexpectedly close. Probably why the "Popover should
    // be shown" step above had to be disabled as well.
    /*
    {
        content: "Check popover content is up-to-date",
        trigger: ":iframe .popover div a:contains('http://callmemaybe.com/shop')",
        isCheck: true,
    },
    */
    // TODO this step is disabled for now because writing "/shop" in above steps
    // currently is not considered most of the time all of a sudden... to
    // investigate (it was not needed in 16.4). See SHOPS_STEP_DISABLED.
    /*
    {
        content: "Check Link tools URL input content is up-to-date",
        trigger: "#o_link_dialog_url_input",
        run() {
            // FIXME this was changed with 69a27360c98aee3d97eb42e9a27a751311791e15
            // to omit the http:// part... but this part is removed
            // inconsistently. Trying to fix the test actually made it so
            // http:// is still there at this point... make it consistent and
            // then remove http:// here again.
            if (this.anchor.value !== 'http://callmemaybe.com/shop') {
                throw new Error("Tour step failed");
            }
        }
    },
    */
    // 11. Pick a URL with auto-complete
    {
        content: "Wait the sidebar is openend",
        trigger: `we-title:contains(Inline text)`,
        extra_trigger: `input#o_link_dialog_url_input`,
        isCheck: true,
    },
    {
        content: "Enter partial URL",
        trigger: "input#o_link_dialog_url_input",
        // TODO: remove extra_trigger
        extra_trigger: 'body:not(:has(.o_we_ui_loading))',
        run: "edit /contact",
    },
    {
        content: "Pick '/contactus",
        trigger: "ul.ui-autocomplete li div:contains('/contactus (Contact Us)')",
        run: "click",
    },
    {
        content: "Check that links's href and label were updated",
        trigger: ":iframe .s_text_image p a[href='/contactus']:contains('/contactus')",
        isCheck: true,
    },
    // 12. Add a link leading to a 404 page
    {
        content: "Enter a non-existent URL",
        trigger: "#o_link_dialog_url_input",
        run: "edit /this-address-does-not-exist",
    },
    {
        content: "Check that the link's href was updated and click on it",
        trigger: ":iframe .s_text_image p a[href='/this-address-does-not-exist']",
        run: "click",
    },
    // TODO this step is disabled for now because it is a cause of race
    // condition (last check: 3 times over 95). The popover seems to sometimes
    // unexpectedly close.
    /*
    {
        content: "Check popover content is up-to-date (2)",
        trigger: ":iframe .popover div a:contains('/this-address-does-not-exist')",
        isCheck: true,
    },
    */
    // 13. Check that ZWS is not added in the link label input.
    clickOnImgStep,
    {
        content: "Click on contact us button",
        trigger: ":iframe a.btn[href='/contactus']",
        run: "click",
    },
    {
        content: "Verify that the link label input does not contain ZWS",
        trigger: "#o_link_dialog_label_input:value('Contact Us')",
        extra_trigger: "div#oe_snippets:not(div.o_we_ui_loading)",
        isCheck: true,
    },
    // TODO: understand why tour need big timeout to passed and remove it
    ...wTourUtils.clickOnSave("bottom", 20000),
]);