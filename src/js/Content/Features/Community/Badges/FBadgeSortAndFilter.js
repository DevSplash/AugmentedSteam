import {HTML, Localization} from "../../../../modulesCore";
import {Feature} from "../../../modulesContent";
import {Page} from "../../Page";

export default class FBadgeSortAndFilter extends Feature {

    apply() {

        this._header = document.querySelector(".profile_badges_header");

        this._addSort();
        this._addFilter();
        this._addViewOptions();

        Page.runInPageContext(() => { window.SteamFacade.bindAutoFlyoutEvents(); });
    }

    _addSort() {

        const isOwnProfile = this.context.myProfile;
        const sortOptions = this._header.querySelector(".profile_badges_sortoptions");

        // Build popup menu for Steam's sort options + our options
        let html = "";
        for (const node of sortOptions.querySelectorAll("a")) {
            const sort = new URL(node.href).searchParams.get("sort");
            html += `<a class="popup_menu_item" href="?sort=${sort}">${node.textContent.trim()}</a>`;
        }
        if (isOwnProfile) {
            html += `<a class="popup_menu_item" id="es_badge_sort_drops">${Localization.str.most_drops}</a>`;
            html += `<a class="popup_menu_item" id="es_badge_sort_value">${Localization.str.drops_value}</a>`;
        }

        const activeText = sortOptions.querySelector(".active").textContent.trim();

        HTML.afterEnd(sortOptions.querySelector("span"),
            `<div class="store_nav">
                <div class="tab flyout_tab" data-flyout="es_sort_flyout" data-flyout-align="right" data-flyout-valign="bottom">
                    <span class="pulldown">
                        <div id="es_sort_active">${activeText}</div>
                        <span></span>
                    </span>
                </div>
            </div>
            <div id="es_sort_flyout" class="popup_block_new flyout_tab_flyout responsive_slidedown">
                <div class="popup_body popup_menu">${html}</div>
            </div>`);

        if (isOwnProfile) {
            document.querySelector("#es_badge_sort_drops").addEventListener("click", async e => {

                if (this.context.hasMultiplePages) {
                    await this._loadAllPages();
                }

                this._sortBadgeRows(e.target.textContent, (node) => {
                    const dropCount = node.querySelector(".progress_info_bold");
                    if (!dropCount) { return 0; }

                    const drops = dropCount.textContent.match(/\d+/);
                    if (!drops) { return 0; }

                    return Number(drops[0]);
                });
            });

            document.querySelector("#es_badge_sort_value").addEventListener("click", async e => {

                if (this.context.hasMultiplePages) {
                    await this._loadAllPages();
                }

                this._sortBadgeRows(e.target.textContent, (node) => {
                    const dropWorth = node.querySelector("[data-es-card-worth]");
                    if (!dropWorth) { return 0; }

                    return parseFloat(dropWorth.dataset.esCardWorth);
                });
            });
        }
    }

    _addFilter() {
        if (!this.context.myProfile) { return; }

        HTML.afterBegin(this._header,
            `<div class="es_badge_filter">
                <span>${Localization.str.show}</span>
                <div class="store_nav">
                    <div class="tab flyout_tab" data-flyout="es_filter_flyout" data-flyout-align="right" data-flyout-valign="bottom">
                        <span class="pulldown">
                            <div id="es_filter_active">${Localization.str.badges_all}</div>
                            <span></span>
                        </span>
                    </div>
                </div>
                <div class="popup_block_new flyout_tab_flyout responsive_slidedown" id="es_filter_flyout">
                    <div class="popup_body popup_menu">
                        <a class="popup_menu_item es_bg_filter" id="es_badge_all">${Localization.str.badges_all}</a>
                        <a class="popup_menu_item es_bg_filter" id="es_badge_drops">${Localization.str.badges_drops}</a>
                    </div>
                </div>
            </div>`);

        document.querySelector("#es_badge_all").addEventListener("click", () => {
            for (const node of document.querySelectorAll(".badge_row")) {
                node.style.display = "block";
            }

            document.querySelector("#es_filter_active").textContent = Localization.str.badges_all;
            document.querySelector("#es_filter_flyout").style.display = "none";
            this._resetLazyLoader();
        });

        document.querySelector("#es_badge_drops").addEventListener("click", async e => {
            e.preventDefault();

            if (this.context.hasMultiplePages) {
                await this._loadAllPages();
            }

            for (const node of document.querySelectorAll(".badge_row")) {
                const stats = node.querySelector(".progress_info_bold");
                if (!stats || !/\d+/.test(stats.textContent)) {
                    node.style.display = "none";
                } else if (node.querySelector(".badge_info_unlocked") && !node.querySelector(".badge_current")) {
                    node.style.display = "none";
                }
            }

            document.querySelector("#es_filter_active").textContent = Localization.str.badges_drops;
            document.querySelector("#es_filter_flyout").style.display = "none";
            this._resetLazyLoader();
        });
    }

    _addViewOptions() {

        HTML.afterBegin(this._header,
            `<div class="es_badge_view">
                <span>${Localization.str.view}</span>
                <div class="store_nav">
                    <div class="tab flyout_tab" data-flyout="es_badgeview_flyout" data-flyout-align="right" data-flyout-valign="bottom">
                        <span class="pulldown">
                            <div id="es_badgeview_active">${Localization.str.theworddefault}</div>
                            <span></span>
                        </span>
                    </div>
                </div>
                <div class="popup_block_new flyout_tab_flyout responsive_slidedown" id="es_badgeview_flyout">
                    <div class="popup_body popup_menu">
                        <a class="popup_menu_item es_bg_view" data-view="defaultview">${Localization.str.theworddefault}</a>
                        <a class="popup_menu_item es_bg_view" data-view="binderview">${Localization.str.binder_view}</a>
                    </div>
                </div>
            </div>`);

        // Change hash when selecting view
        document.querySelector("#es_badgeview_flyout").addEventListener("click", e => {
            const node = e.target.closest(".es_bg_view");
            if (!node) { return; }
            window.location.hash = node.dataset.view;
            e.currentTarget.style.display = "none"; // Hide popup
        });

        // Monitor for hash changes
        window.addEventListener("hashchange", () => { this._toggleBinderView(); });

        this._toggleBinderView();
    }

    async _loadAllPages() {

        if (this._hasAllPagesLoaded) { return; }
        this._hasAllPagesLoaded = true;

        const sheetNode = document.querySelector(".badges_sheet");

        // let images = Viewport.getVariableFromDom("g_rgDelayedLoadImages", "object");

        await this.context.eachBadgePage(dom => {
            for (const node of dom.querySelectorAll(".badge_row")) {
                sheetNode.append(node);
            }

            this.context.triggerCallbacks();

            // images = Object.assign(images, Viewport.getVariableFromDom("g_rgDelayedLoadImages", "object", dom));
        });

        for (const node of document.querySelectorAll(".profile_paging")) {
            node.style.display = "none";
        }

        /*
         * TODO this doesn't seem to work, can't figure out why right now. Lazy loader doesn't see updated object?
         * ExtensionLayer.runInPageContext("function(){g_rgDelayedLoadImages = " + JSON.stringify(images) + ";}");
         * resetLazyLoader();
         */
    }

    _sortBadgeRows(activeText, nodeValueCallback) {
        const badgeRows = [];
        for (const node of document.querySelectorAll(".badge_row")) {
            badgeRows.push([node.outerHTML, nodeValueCallback(node)]);
            node.remove();
        }

        badgeRows.sort((a, b) => b[1] - a[1]);

        const sheetNode = document.querySelector(".badges_sheet");
        for (const row of badgeRows) {
            HTML.beforeEnd(sheetNode, row[0]);
        }

        this._resetLazyLoader();
        document.querySelector("#es_sort_active").textContent = activeText;
        document.querySelector("#es_sort_flyout").style.display = "none";
    }

    _resetLazyLoader() {

        // FIXME this doesn't seem to work

        /*
         * ExtensionLayer.runInPageContext(() => {
         *
         *  // Clear registered image lazy loader watchers (CScrollOffsetWatcher is found in shared_global.js)
         *  CScrollOffsetWatcher.sm_rgWatchers = [];
         *
         *  // Recreate registered image lazy loader watchers
         *  $J("div[id^=image_group_scroll_badge_images_gamebadge_]").each((i, e) => {
         *
         *      // LoadImageGroupOnScroll is found in shared_global.js
         *      LoadImageGroupOnScroll(e.id, e.id.substr(19));
         *  });
         * });
         */
    }

    _toggleBinderView() {

        const mainNode = document.querySelector("div.maincontent");

        if (window.location.hash === "#binderview") {
            mainNode.classList.add("es_binder_view");

            // Don't attempt changes again if already loaded
            if (!mainNode.classList.contains("es_binder_loaded")) {
                mainNode.classList.add("es_binder_loaded");

                for (const node of document.querySelectorAll(".badge_row")) {
                    const stats = node.querySelector(".progress_info_bold");
                    if (stats && /\d+/.test(stats.textContent)) {
                        HTML.beforeEnd(node.querySelector(".badge_content"), `<span class="es_game_stats">${stats.innerHTML}</span>`);
                    }

                    const infoNode = node.querySelector(".badge_progress_info");
                    if (infoNode) {
                        const card = infoNode.textContent.match(/(\d+)\D*(\d+)/);
                        if (card) {
                            HTML.beforeBegin(infoNode, `<div class="es_badge_progress_info">${card[1]} / ${card[2]}</div>`);
                        }
                    }
                }
            }

            // Add hash to pagination links
            for (const node of document.querySelectorAll("div.pageLinks a.pagelink, div.pageLinks a.pagebtn")) {
                node.href += "#binderview";
            }

            // Triggers the loading of out-of-view badge images
            window.dispatchEvent(new Event("resize"));

            document.querySelector("#es_badgeview_active").textContent = Localization.str.binder_view;
        } else {
            mainNode.classList.remove("es_binder_view");

            // Remove hash from pagination links
            for (const node of document.querySelectorAll("div.pageLinks a.pagelink, div.pageLinks a.pagebtn")) {
                node.href = node.href.replace("#binderview", "");
            }

            document.querySelector("#es_badgeview_active").textContent = Localization.str.theworddefault;
        }
    }
}
