import type { CSSProperties } from "react";
import add from "lets-icons/icons/add-light.svg";
import arrowDown from "lets-icons/icons/arrow-drop-down.svg";
import bell from "lets-icons/icons/bell-light.svg";
import book from "lets-icons/icons/book-light.svg";
import bookCheck from "lets-icons/icons/book-check-light.svg";
import bookOpen from "lets-icons/icons/book-open-light.svg";
import chart from "lets-icons/icons/chart-alt-light.svg";
import clock from "lets-icons/icons/clock-light.svg";
import close from "lets-icons/icons/close-round-light.svg";
import compass from "lets-icons/icons/compass-light.svg";
import edit from "lets-icons/icons/edit-light.svg";
import flag from "lets-icons/icons/flag-light.svg";
import folders from "lets-icons/icons/folders-light.svg";
import gamepad from "lets-icons/icons/gamepad-light.svg";
import group from "lets-icons/icons/group-light.svg";
import groupShare from "lets-icons/icons/group-share-light.svg";
import layers from "lets-icons/icons/layers-light.svg";
import map from "lets-icons/icons/map-light.svg";
import message from "lets-icons/icons/message-light.svg";
import question from "lets-icons/icons/question-light.svg";
import road from "lets-icons/icons/road-light.svg";
import settings from "lets-icons/icons/setting-alt-line-light.svg";
import suitCase from "lets-icons/icons/suitcase-light.svg";
import trophy from "lets-icons/icons/trophy-light.svg";
import videoFile from "lets-icons/icons/video-file-light.svg";
import widget from "lets-icons/icons/widget-light.svg";

const icons: Record<string, string> = {
  add,
  assignment: bookCheck,
  campaign: flag,
  casino: gamepad,
  category: folders,
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
  return (
    <span
      aria-hidden="true"
      className={["lets-icon", className].filter(Boolean).join(" ")}
      data-lets-icon={name}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        flex: "0 0 auto",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${source})`,
        maskImage: `url(${source})`,
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        ...style,
      }}
    />
  );
}
