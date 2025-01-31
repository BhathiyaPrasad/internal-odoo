/** @odoo-module**/
/* global ace */

import wTourUtils from "@website/js/tours/tour_utils";

const adminCssModif = '#wrap {display: none;}';
const demoCssModif = '// demo_edition';

wTourUtils.registerWebsitePreviewTour('html_editor_multiple_templates', {
    url: '/generic',
    edition: true,
    test: true,
},
    () => [
        {
            content: "drop a snippet",
            trigger: ".oe_snippet .oe_snippet_thumbnail[data-snippet=s_cover]",
            // id starting by 'oe_structure..' will actually create an inherited view
            run: "drag_and_drop :iframe #oe_structure_test_ui",
        },
        ...wTourUtils.clickOnSave(),
        // 2. Edit generic view
        {
            content: "open site menu",
            trigger: 'button[data-menu-xmlid="website.menu_site"]',
            run: "click",
        },
        {
            content: "open html editor",
            trigger: 'a[data-menu-xmlid="website.menu_ace_editor"]',
            run: "click",
        },
        {
            content: "add something in the generic view",
            trigger: 'div.ace_line .ace_xml:contains("Generic")',
            run: function () {
                ace.edit(document.querySelector('#resource-editor div')).getSession().insert({row: 3, column: 1}, '<p>somenewcontent</p>\n');
            },
        },
        // 3. Edit oe_structure specific view
        {
            content: "select oe_structure specific view",
            trigger: 'div.ace_line .ace_xml:contains("somenewcontent")',
            run: function () {},
        },
        {
            content: "open file selector menu",
            trigger: ".o_resource_editor .o_select_menu_toggler",
            run: "click",
        },
        {
            content: "open oe_structure_test_ui view",
            trigger: ".o-dropdown--menu .o-dropdown-item:contains(oe_structure_test_ui)",
            run: "click",
        },
        {
            content: "add something in the oe_structure specific view",
            extra_trigger: '.o_resource_editor .o_select_menu_toggler:contains("oe_structure_test_ui")',
            trigger: 'div.ace_line .ace_xml:contains("s_cover")',
            run: function () {
                ace.edit(document.querySelector('#resource-editor div')).getSession().insert({row: 2, column: 1}, '<p>anothernewcontent</p>\n');
            },
        },
        {
            content: "save the html editor",
            extra_trigger: 'div.ace_line .ace_xml:contains("anothernewcontent")',
            trigger: ".o_resource_editor button:contains(Save)",
            run: "click",
        },
        {
           content: "check that the page has both modification",
           extra_trigger: ':iframe #wrapwrap:contains("anothernewcontent")',
           trigger: ':iframe #wrapwrap:contains("somenewcontent")',
           run: function () {}, // it's a check
       },
    ]
);

wTourUtils.registerWebsitePreviewTour('test_html_editor_scss', {
    url: '/contactus',
    test: true,
},
    () => [
        // 1. Open Html Editor and select a scss file
        {
            content: "open site menu",
            extra_trigger: ':iframe #wrap:visible', // ensure state for later
            trigger: 'button[data-menu-xmlid="website.menu_site"]',
            run: "click",
        },
        {
            content: "open html editor",
            trigger: 'a[data-menu-xmlid="website.menu_ace_editor"]',
            run: "click",
        },
        {
            content: "open type switcher",
            trigger: '.o_resource_editor_type_switcher button',
            run: "click",
        },
        {
            content: "select scss files",
            trigger: '.o-dropdown--menu .dropdown-item:contains("SCSS")',
            run: "click",
        },
        {
            content: "select 'user_custom_rules'",
            trigger: '.o_resource_editor .o_select_menu_toggler:contains("user_custom_rules")',
            run: () => {},
        },
        // 2. Edit that file and ensure it was saved then reset it
        {
            content: "add some scss content in the file",
            trigger: 'div.ace_line .ace_comment:contains("footer {")',
            run: function () {
                ace.edit(document.querySelector('#resource-editor div')).getSession().insert({row: 2, column: 0}, `${adminCssModif}\n`);
            },
        },
        {
            content: "save the html editor",
            extra_trigger: `div.ace_line:contains("${adminCssModif}")`,
            trigger: ".o_resource_editor_title button:contains(Save)",
            run: "click",
        },
        {
            content: "check that the scss modification got applied",
            trigger: ':iframe body:has(#wrap:hidden)',
            run: function () {}, // it's a check
            timeout: 30000, // SCSS compilation might take some time
        },
        {
            content: "reset view (after reload, html editor should have been reopened where it was)",
            trigger: '#resource-editor-id button:contains(Reset)',
            run: "click",
        },
        {
            content: "confirm reset warning",
            trigger: '.modal-footer .btn-primary',
            run: "click",
        },
        {
            content: "check that the scss file was reset correctly, wrap content should now be visible again",
            trigger: ':iframe #wrap:visible',
            run: function () {}, // it's a check
            timeout: 30000, // SCSS compilation might take some time
        },
        // 3. Customize again that file (will be used in second part of the test
        //    to ensure restricted user can still use the HTML Editor)
        {
            content: "add some scss content in the file",
            trigger: 'div.ace_line .ace_comment:contains("footer {")',
            run: function () {
                ace.edit(document.querySelector('#resource-editor div')).getSession().insert({row: 2, column: 0}, `${adminCssModif}\n`);
            },
        },
        {
            content: "save the html editor",
            extra_trigger: `div.ace_line:contains("${adminCssModif}")`,
            trigger: ".o_resource_editor_title button:contains(Save)",
            run: "click",
        },
        {
            content: "check that the scss modification got applied",
            trigger: ':iframe body:has(#wrap:hidden)',
            run: function () {}, // it's a check
        },
    ]
);

wTourUtils.registerWebsitePreviewTour('test_html_editor_scss_2', {
    url: '/',
    test: true,
},
    () => [
        // This part of the test ensures that a restricted user can still use
        // the HTML Editor if someone else made a customization previously.

        // 4. Open Html Editor and select a scss file
        {
            content: "open site menu",
            trigger: 'button[data-menu-xmlid="website.menu_site"]',
            run: "click",
        },
        {
            content: "open html editor",
            trigger: 'a[data-menu-xmlid="website.menu_ace_editor"]',
            run: "click",
        },
        {
            content: "open type switcher",
            trigger: '.o_resource_editor_type_switcher button',
            run: "click",
        },
        {
            content: "select scss files",
            trigger: '.o-dropdown--menu .dropdown-item:contains("SCSS")',
            run: "click",
        },
        {
            content: "select 'user_custom_rules'",
            trigger: '.o_resource_editor .o_select_menu_toggler:contains("user_custom_rules")',
            run: () => {},
        },
        // 5. Edit that file and ensure it was saved then reset it
        {
            content: "add some scss content in the file",
            trigger: `div.ace_line:contains("${adminCssModif}")`, // ensure the admin modification is here
            run: function () {
                ace.edit(document.querySelector('#resource-editor div')).getSession().insert({row: 2, column: 0}, `${demoCssModif}\n`);
            },
        },
        {
            content: "save the html editor",
            extra_trigger: `div.ace_line:contains("${demoCssModif}")`,
            trigger: ".o_resource_editor button:contains(Save)",
            run: "click",
        },
        {
            content: "reset view (after reload, html editor should have been reopened where it was)",
            trigger: '#resource-editor-id button:contains(Reset)',
            timeout: 30000, // SCSS compilation might take some time
            run: "click",
        },
        {
            content: "confirm reset warning",
            trigger: '.modal-footer .btn-primary',
            run: "click",
        },
        {
            content: "check that the scss file was reset correctly",
            extra_trigger: `body:not(:has(div.ace_line:contains("${adminCssModif}")))`,
            trigger: `body:not(:has(div.ace_line:contains("${demoCssModif}")))`,
            run: function () {}, // it's a check
            timeout: 30000, // SCSS compilation might take some time
        },
    ]
);

wTourUtils.registerWebsitePreviewTour(
    "website_code_editor_usable",
    {
        // TODO: enable debug mode when failing tests have been fixed (props validation)
        url: "/",
        test: true,
    },
    () => [
        {
            content: "Open Site menu",
            trigger: 'button[data-menu-xmlid="website.menu_site"]',
        },
        {
            content: "Open HTML / CSS Editor",
            trigger: 'a[data-menu-xmlid="website.menu_ace_editor"]',
        },
        {
            content: "Bypass warning",
            trigger: ".o_resource_editor_wrapper div:nth-child(2) button:nth-child(3)",
        },
        // Test all 3 file type options
        ...[{
            menuItemIndex: 1,
            editorMode: 'qweb',
        }, {
            menuItemIndex: 2,
            editorMode: 'scss',
        }, {
            menuItemIndex: 3,
            editorMode: 'javascript',
        }]
            .map(({ menuItemIndex, editorMode }) => [
                {
                    content: "Open file type dropdown",
                    trigger: ".o_resource_editor_type_switcher .dropdown-toggle",
                },
                {
                    content: `Select type ${menuItemIndex}`,
                    trigger: `.o-overlay-container .o-dropdown--menu .dropdown-item:nth-child(${menuItemIndex})`,
                },
                {
                    content: "Wait for editor mode to change",
                    trigger: `.ace_editor[data-mode="${editorMode}"]`,
                    isCheck: true,
                },
                {
                    content: "Make sure text is being highlighted",
                    trigger: ".ace_content .ace_text-layer .ace_line:first-child span",
                    isCheck: true,
                },
            ])
            .flat(),
    ]
);
