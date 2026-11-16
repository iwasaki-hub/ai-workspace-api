/**
 * Font Awesome icon registry — single source of truth for the site's icons.
 *
 * To change an icon, update its semantic key here. EJS views should use
 * <%- icon("key") %>, never import Font Awesome or hardcode icon classes.
 * All icons are rendered server-side; no CDN, kit key, or client script.
 */
import { icon as renderFontAwesome } from "@fortawesome/fontawesome-svg-core";
import {
  faHouse, faList, faFlask, faBookOpen, faGraduationCap,
  faHeartPulse, faCode, faFileCode, faArrowUpRightFromSquare,
  faArrowRight, faPaperPlane, faCopy, faTerminal, faDatabase,
  faLayerGroup, faMagnifyingGlass, faRocket, faChevronLeft,
  faBars, faCircleInfo, faCircleCheck, faLink, faShieldHalved, faUsers
} from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

export const iconRegistry = Object.freeze({
  brand: faCode,
  overview: faHouse,
  endpoints: faList,
  playground: faFlask,
  swagger: faBookOpen,
  examples: faGraduationCap,
  roadmap: faRocket,
  health: faHeartPulse,
  github: faGithub,
  external: faArrowUpRightFromSquare,
  arrow: faArrowRight,
  send: faPaperPlane,
  copy: faCopy,
  terminal: faTerminal,
  database: faDatabase,
  users: faUsers,
  layers: faLayerGroup,
  search: faMagnifyingGlass,
  back: faChevronLeft,
  menu: faBars,
  info: faCircleInfo,
  success: faCircleCheck,
  link: faLink,
  shield: faShieldHalved,
  json: faFileCode,
});

/** Render trusted, decorative SVG markup from a known semantic icon key. */
const renderedIcons = new Map();
export function icon(name) {
  if (!Object.hasOwn(iconRegistry, name)) {
    throw new Error(`Unknown Font Awesome icon key: ${name}`);
  }
  if (!renderedIcons.has(name)) {
    const rendered = renderFontAwesome(iconRegistry[name], {
      classes: ["ui-icon"],
      attributes: { "aria-hidden": "true", focusable: "false" },
    });
    if (!rendered?.html?.[0]) throw new Error(`Could not render Font Awesome icon: ${name}`);
    renderedIcons.set(name, rendered.html.join(""));
  }
  return renderedIcons.get(name);
}
