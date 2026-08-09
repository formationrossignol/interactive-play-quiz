import type { CSSProperties } from "react";
import add from "lets-icons/icons/add-light.svg?raw";
import arrowBack from "lets-icons/icons/arrow-left-long-light.svg?raw";
import arrowDown from "lets-icons/icons/arrow-drop-down.svg?raw";
import arrowForward from "lets-icons/icons/arrow-right-long-light.svg?raw";
import bell from "lets-icons/icons/bell-light.svg?raw";
import book from "lets-icons/icons/book-light.svg?raw";
import bookCheck from "lets-icons/icons/book-check-light.svg?raw";
import bookOpen from "lets-icons/icons/book-open-light.svg?raw";
import chart from "lets-icons/icons/chart-alt-light.svg?raw";
import check from "lets-icons/icons/check-ring-light.svg?raw";
import clock from "lets-icons/icons/clock-light.svg?raw";
import close from "lets-icons/icons/close-round-light.svg?raw";
import compass from "lets-icons/icons/compass-light.svg?raw";
import edit from "lets-icons/icons/edit-light.svg?raw";
import flag from "lets-icons/icons/flag-light.svg?raw";
import folders from "lets-icons/icons/folders-light.svg?raw";
import gamepad from "lets-icons/icons/gamepad-light.svg?raw";
import group from "lets-icons/icons/group-light.svg?raw";
import groupShare from "lets-icons/icons/group-share-light.svg?raw";
import layers from "lets-icons/icons/layers-light.svg?raw";
import map from "lets-icons/icons/map-light.svg?raw";
import message from "lets-icons/icons/message-light.svg?raw";
import question from "lets-icons/icons/question-light.svg?raw";
import road from "lets-icons/icons/road-light.svg?raw";
import settings from "lets-icons/icons/setting-alt-line-light.svg?raw";
import suitCase from "lets-icons/icons/suitcase-light.svg?raw";
import trophy from "lets-icons/icons/trophy-light.svg?raw";
import videoFile from "lets-icons/icons/video-file-light.svg?raw";
import widget from "lets-icons/icons/widget-light.svg?raw";

const icons: Record<string, string> = {
  add,
  arrow_back: arrowBack,
  arrow_forward: arrowForward,
  assignment: bookCheck,
  campaign: flag,
  casino: gamepad,
  category: folders,
  check,
  close,
  co_present: videoFile,
  dashboard: widget,
  domain: suitCase,
  draw: edit,
  edit_note: edit,
  explore: compass,
  fact_check: bookCheck,
  grading: bookCheck,
  group_share: groupShare,
  groups: group,
  help: question,
  history: clock,
  keyboard_arrow_down: arrowDown,
  library_books: book,
  map,
  notifications: bell,
  poll: chart,
  quiz: question,
  route: road,
  school: bookOpen,
  settings,
  style: layers,
  support_agent: message,
  workspace_premium: trophy,
};

export function LetsIcon({
  name,
  size = 20,
  className,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const source = icons[name] ?? question;
  // Trusted local assets from Lets Icons: rendering the SVG itself preserves
  // currentColor without relying on masks that can degrade into solid squares.
  const markup = source.replace(
    "<svg ",
    '<svg width="100%" height="100%" focusable="false" style="display:block" ',
  );

  return (
    <span
      aria-hidden="true"
      className={["lets-icon", className].filter(Boolean).join(" ")}
      data-lets-icon={name}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        flex: "0 0 auto",
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
