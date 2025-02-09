import { get } from "@ember/object";
import { htmlSafe } from "@ember/template";
import { isRTL } from "discourse/lib/text-direction";
import { escapeExpression } from "discourse/lib/utilities";
import Category from "discourse/models/category";
import getURL from "discourse-common/lib/get-url";
import { helperContext, registerRawHelper } from "discourse-common/lib/helpers";
import { iconHTML } from "discourse-common/lib/icon-library";
import I18n from "discourse-i18n";

let _renderer = defaultCategoryLinkRenderer;

export function replaceCategoryLinkRenderer(fn) {
  _renderer = fn;
}

let _extraIconRenderers = [];

export function addExtraIconRenderer(renderer) {
  _extraIconRenderers.push(renderer);
}

/**
  Generates category badge HTML

  @param {Object} category The category to generate the badge for.
  @param {Object} opts
    @param {String}  [opts.url] The url that we want the category badge to link to.
    @param {Boolean} [opts.allowUncategorized] If false, returns an empty string for the uncategorized category.
    @param {Boolean} [opts.link] If false, the category badge will not be a link.
    @param {Boolean} [opts.hideParent] If true, parent category will be hidden in the badge.
    @param {Boolean} [opts.recursive] If true, the function will be called recursively for all parent categories
    @param {Number}  [opts.depth] Current category depth, used for limiting recursive calls
**/
export function categoryBadgeHTML(category, opts) {
  const { site, siteSettings } = helperContext();
  opts = opts || {};

  if (
    !category ||
    (!opts.allowUncategorized &&
      get(category, "id") === site.uncategorized_category_id &&
      siteSettings.suppress_uncategorized_badge)
  ) {
    return "";
  }

  const depth = (opts.depth || 1) + 1;
  if (opts.recursive && depth <= siteSettings.max_category_nesting) {
    const parentCategory = Category.findById(category.parent_category_id);
    const lastSubcategory = !opts.depth;
    opts.depth = depth;
    const parentBadges = categoryBadgeHTML(parentCategory, opts);
    opts.lastSubcategory = lastSubcategory;
    return parentBadges + _renderer(category, opts);
  }

  return _renderer(category, opts);
}

export function categoryLinkHTML(category, options) {
  let categoryOptions = {};

  // TODO: This is a compatibility layer with the old helper structure.
  // Can be removed once we migrate to `registerUnbound` fully
  if (options && options.hash) {
    options = options.hash;
  }

  if (options) {
    if (options.allowUncategorized) {
      categoryOptions.allowUncategorized = true;
    }
    if (options.link !== undefined) {
      categoryOptions.link = options.link;
    }
    if (options.extraClasses) {
      categoryOptions.extraClasses = options.extraClasses;
    }
    if (options.hideParent) {
      categoryOptions.hideParent = true;
    }
    if (options.recursive) {
      categoryOptions.recursive = true;
    }
  }
  return htmlSafe(categoryBadgeHTML(category, categoryOptions));
}

export default categoryLinkHTML;
registerRawHelper("category-link", categoryLinkHTML);

function buildTopicCount(count) {
  return `<span class="topic-count" aria-label="${I18n.t(
    "category_row.topic_count",
    { count }
  )}">&times; ${count}</span>`;
}

export function defaultCategoryLinkRenderer(category, opts) {
  let descriptionText = get(category, "description_text");
  let restricted = get(category, "read_restricted");
  let url = opts.url
    ? opts.url
    : getURL(`/c/${Category.slugFor(category)}/${get(category, "id")}`);
  let href = opts.link === false ? "" : url;
  let tagName = opts.link === false || opts.link === "false" ? "span" : "a";
  let extraClasses = opts.extraClasses ? " " + opts.extraClasses : "";
  let html = "";
  let parentCat = null;
  let categoryDir = "";
  let dataAttributes = category
    ? `data-category-id="${get(category, "id")}"`
    : "";

  if (!opts.hideParent) {
    parentCat = Category.findById(get(category, "parent_category_id"));
  }

  let siteSettings = helperContext().siteSettings;

  let classNames = `badge-category`;
  if (restricted) {
    classNames += " restricted";
  }

  if (parentCat) {
    classNames += ` --has-parent`;
    dataAttributes += ` data-parent-category-id="${parentCat.id}"`;
  }

  html += `<span 
    ${dataAttributes} 
    data-drop-close="true" 
    class="${classNames}" 
    ${descriptionText ? 'title="' + descriptionText + '" ' : ""}
  >`;

  let categoryName = escapeExpression(get(category, "name"));

  if (siteSettings.support_mixed_text_direction) {
    categoryDir = isRTL(categoryName) ? 'dir="rtl"' : 'dir="ltr"';
  }

  if (restricted) {
    html += iconHTML("lock");
  }
  _extraIconRenderers.forEach((renderer) => {
    const iconName = renderer(category);
    if (iconName) {
      html += iconHTML(iconName);
    }
  });
  html += `<span class="badge-category__name" ${categoryDir}>${categoryName}</span>`;
  html += "</span>";

  if (opts.topicCount) {
    html += buildTopicCount(opts.topicCount);
  }

  if (href) {
    href = ` href="${href}" `;
  }

  let afterBadgeWrapper = "";

  if (opts.plusSubcategories && opts.lastSubcategory) {
    afterBadgeWrapper += `<span class="plus-subcategories">
      ${I18n.t("category_row.plus_subcategories", {
        count: opts.plusSubcategories,
      })}
      </span>`;
  }
  return `<${tagName} class="badge-category__wrapper ${extraClasses}" ${href}>${html}</${tagName}>${afterBadgeWrapper}`;
}
