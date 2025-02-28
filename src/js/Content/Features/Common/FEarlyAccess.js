import {ExtensionResources, GameId, HTML, Language, Localization, SyncedStorage} from "../../../modulesCore";
import {Background, Feature} from "../../modulesContent";

export default class FEarlyAccess extends Feature {

    apply() {
        FEarlyAccess.show();
    }

    static async show(nodes) {
        if (!SyncedStorage.get("show_early_access")) { return; }

        const _nodes = nodes || document.querySelectorAll(this._selector);
        if (_nodes.length === 0) { return; }

        if (!this._container) {

            // TODO add missing images for supported locales
            let imageName = "img/overlay/early_access_banner_english.png";
            if (Language.isCurrentLanguageOneOf([
                "brazilian",
                "french",
                "italian",
                "japanese",
                "koreana",
                "polish",
                "portuguese",
                "russian",
                "schinese",
                "spanish",
                "latam",
                "tchinese",
                "thai"
            ])) {
                imageName = `img/overlay/early_access_banner_${Language.getCurrentSteamLanguage()}.png`;
            }

            const imageUrl = ExtensionResources.getURL(imageName);

            this._container = HTML.element(
                `<span class="es_overlay_container">
                    <span class="es_overlay">
                        <img title="${Localization.str.early_access}" src="${imageUrl}">
                    </span>
                </span>`
            );
        }

        for (const node of await this.getEaNodes(_nodes)) {

            /*
             * TODO It's possible a child element has been checked already, remove when not needed
             * e.g. duplicate elements on the storefront (More Curator Recommendations)
             * and when called with the same arguments as highlighting (observing changes in CStoreBase)
             */
            if (node.querySelector(".es_overlay_container") !== null) { continue; }

            node.classList.add("es_early_access");

            const imgHeader = node.querySelector("img");
            if (!imgHeader) { continue; }

            const container = this._container.cloneNode(true);
            imgHeader.insertAdjacentElement("afterend", container);
            container.append(imgHeader);
        }
    }

    static async getEaNodes(nodes) {

        const appidsMap = new Map();

        for (const node of nodes) {

            node.classList.add("es_ea_checked");

            // Skip the live streams section since the thumbnail is shown on top
            if (node.classList.contains("store_capsule") && node.querySelector(".capsule[id^=broadcast]") !== null) {
                continue;
            }

            let appid = GameId.getAppid(node)
                || GameId.getAppid(node.querySelector("a"))
                || GameId.getAppidImgSrc(node.querySelector("img"));

            if (appid) {
                appid = String(appid);
                if (appidsMap.has(appid)) {
                    appidsMap.get(appid).push(node);
                } else {
                    appidsMap.set(appid, [node]);
                }
            }
        }

        const appids = Array.from(appidsMap.keys());
        if (appids.length === 0) { return []; }

        const eaStatus = await Background.action("isea", appids);

        for (const appid of appids) {
            if (!eaStatus[appid]) {
                appidsMap.delete(appid);
            }
        }

        return [].concat(...appidsMap.values()); // flat() is supported in FF 62
    }
}

// TODO support React-based sales pages, curator lists, etc.
FEarlyAccess._selector = [
    // Store only, selectors for the Community are split into relevant contexts
    ".tab_item", // Item rows on storefront, genre, category, tags etc. pages
    ".quadscreenshot_carousel a", // Top carousel on genre, category, tags etc. pages
    ".newonsteam_headercap", // explore/new
    ".comingsoon_headercap", // explore/upcoming
    ".store_capsule",
    ".dailydeal_ctn",
    ".special.special_img_ctn",
    /*
     * These use CSS backgrounds instead of img elements, unsupported for now
     * ".store_main_capsule", // Featured & Recommended
     * ".home_marketing_message", // Updates and Offers
     */
    ".home_area_spotlight", // Special Offers, specials/
    ".curator_giant_capsule", // Curator Recommendations
    ".home_content_item",
    ".home_content.single",
    ".highlighted_app_header", // curators/
    "#curator_avatar_image", // Header image on dlc pages
    ".curator_featured a", // Featured items on curator, developer, publisher, franchise, dlc etc. pages
    ".search_result_row",
    ".small_cap", // "recommended" section on app pages
    ".browse_tag_game_cap", // tag/browse
    ".header_image", // recommended/morelike, friendactivity header
    ".similar_grid_capsule", // recommended/morelike
    ".friend_game_block a[data-ds-appid]",
    ".friendactivity_tab_row",
    ".recommendation_app",
    ".recommendation_carousel_item",
    ".app_header",
    ".friendplaytime_appheader",
].map(sel => `${sel}:not(.es_ea_checked)`)
    .join(",");
