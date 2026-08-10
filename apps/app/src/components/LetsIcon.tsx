import type { HTMLAttributes } from "react";
import add from "lets-icons/icons/add-light.svg?raw";
import arrowBack from "lets-icons/icons/arrow-left-long-light.svg?raw";
import arrowDown from "lets-icons/icons/arrow-drop-down.svg?raw";
import arrowForward from "lets-icons/icons/arrow-right-long-light.svg?raw";
import arrowTop from "lets-icons/icons/arrow-top-light.svg?raw";
import bell from "lets-icons/icons/bell-light.svg?raw";
import book from "lets-icons/icons/book-light.svg?raw";
import bookCheck from "lets-icons/icons/book-check-light.svg?raw";
import bookOpen from "lets-icons/icons/book-open-light.svg?raw";
import bug from "lets-icons/icons/bug-light.svg?raw";
import calendar from "lets-icons/icons/calendar-light.svg?raw";
import camera from "lets-icons/icons/camera-light.svg?raw";
import chart from "lets-icons/icons/chart-alt-light.svg?raw";
import chield from "lets-icons/icons/chield-light.svg?raw";
import check from "lets-icons/icons/check-ring-light.svg?raw";
import clock from "lets-icons/icons/clock-light.svg?raw";
import close from "lets-icons/icons/close-round-light.svg?raw";
import compass from "lets-icons/icons/compass-light.svg?raw";
import copy from "lets-icons/icons/copy-light.svg?raw";
import creditCard from "lets-icons/icons/credit-card-light.svg?raw";
import edit from "lets-icons/icons/edit-light.svg?raw";
import external from "lets-icons/icons/external.svg?raw";
import flag from "lets-icons/icons/flag-light.svg?raw";
import filter from "lets-icons/icons/filter-alt-light.svg?raw";
import fire from "lets-icons/icons/fire-light.svg?raw";
import folder from "lets-icons/icons/folder-light.svg?raw";
import folderOpen from "lets-icons/icons/folder-open-light.svg?raw";
import folders from "lets-icons/icons/folders-light.svg?raw";
import gamepad from "lets-icons/icons/gamepad-light.svg?raw";
import globe from "lets-icons/icons/globe-light.svg?raw";
import group from "lets-icons/icons/group-light.svg?raw";
import groupShare from "lets-icons/icons/group-share-light.svg?raw";
import hideEye from "lets-icons/icons/hide-eye-light.svg?raw";
import eye from "lets-icons/icons/eye-light.svg?raw";
import home from "lets-icons/icons/home-light.svg?raw";
import hourglass from "lets-icons/icons/hourglass-light.svg?raw";
import key from "lets-icons/icons/key-light.svg?raw";
import lamp from "lets-icons/icons/lamp-light.svg?raw";
import layers from "lets-icons/icons/layers-light.svg?raw";
import lightning from "lets-icons/icons/lightning-light.svg?raw";
import link from "lets-icons/icons/link-light.svg?raw";
import list from "lets-icons/icons/load-list-light.svg?raw";
import lock from "lets-icons/icons/lock-light.svg?raw";
import map from "lets-icons/icons/map-light.svg?raw";
import menu from "lets-icons/icons/menu.svg?raw";
import message from "lets-icons/icons/message-light.svg?raw";
import messageOpen from "lets-icons/icons/message-open-light.svg?raw";
import comment from "lets-icons/icons/comment-light.svg?raw";
import image from "lets-icons/icons/img-light.svg?raw";
import money from "lets-icons/icons/money-light.svg?raw";
import moon from "lets-icons/icons/moon-light.svg?raw";
import more from "lets-icons/icons/meatballs-menu.svg?raw";
import move from "lets-icons/icons/move-light.svg?raw";
import paper from "lets-icons/icons/paper-light.svg?raw";
import play from "lets-icons/icons/play-light.svg?raw";
import question from "lets-icons/icons/question-light.svg?raw";
import refresh from "lets-icons/icons/refresh-light.svg?raw";
import remove from "lets-icons/icons/remove-light.svg?raw";
import road from "lets-icons/icons/road-light.svg?raw";
import save from "lets-icons/icons/save-light.svg?raw";
import search from "lets-icons/icons/search-light.svg?raw";
import send from "lets-icons/icons/send-light.svg?raw";
import server from "lets-icons/icons/server-light.svg?raw";
import settings from "lets-icons/icons/setting-alt-line-light.svg?raw";
import signIn from "lets-icons/icons/sign-in-circle-light.svg?raw";
import signOut from "lets-icons/icons/sign-out-circle-light.svg?raw";
import soundMax from "lets-icons/icons/sound-max-light.svg?raw";
import soundMute from "lets-icons/icons/sound-mute-light.svg?raw";
import star from "lets-icons/icons/star-light.svg?raw";
import sun from "lets-icons/icons/sun-light.svg?raw";
import suitCase from "lets-icons/icons/suitcase-light.svg?raw";
import target from "lets-icons/icons/target-light.svg?raw";
import thumbUp from "lets-icons/icons/thumb-up.svg?raw";
import ticket from "lets-icons/icons/ticket-light.svg?raw";
import trash from "lets-icons/icons/trash-light.svg?raw";
import trophy from "lets-icons/icons/trophy-light.svg?raw";
import upload from "lets-icons/icons/upload-light.svg?raw";
import user from "lets-icons/icons/user-light.svg?raw";
import videoFile from "lets-icons/icons/video-file-light.svg?raw";
import widget from "lets-icons/icons/widget-light.svg?raw";

const icons: Record<string, string> = {
  account_circle: user,
  add,
  add_reaction: add,
  add_task: check,
  admin_panel_settings: chield,
  apartment: suitCase,
  analytics: chart,
  arrow_back: arrowBack,
  arrow_drop_down: arrowDown,
  arrow_drop_up: arrowTop,
  arrow_downward: arrowDown,
  arrow_forward: arrowForward,
  arrow_upward: arrowTop,
  assignment: bookCheck,
  assignment_turned_in: check,
  auto_awesome: star,
  bar_chart: chart,
  bolt: lightning,
  bug_report: bug,
  campaign: flag,
  casino: gamepad,
  category: folders,
  celebration: star,
  check,
  check_circle: check,
  chevron_left: arrowBack,
  chevron_right: arrowForward,
  circle: check,
  close,
  cloud_upload: upload,
  co_present: videoFile,
  confirmation_number: ticket,
  construction: settings,
  content_copy: copy,
  create_new_folder: folders,
  credit_card: creditCard,
  dark_mode: moon,
  dashboard: widget,
  dashboard_customize: widget,
  date_range: calendar,
  delete: trash,
  dns: server,
  domain: suitCase,
  domain_disabled: suitCase,
  done_all: check,
  donut_small: chart,
  drag_indicator: more,
  drag_handle: move,
  draw: edit,
  drive_file_move: folder,
  edit,
  edit_note: edit,
  edit_square: edit,
  mode_edit: edit,
  pencil: edit,
  emoji_events: trophy,
  error: chield,
  event_upcoming: calendar,
  expand_less: arrowTop,
  expand_more: arrowDown,
  explore: compass,
  fact_check: bookCheck,
  flag,
  folder,
  folder_open: folderOpen,
  forum: comment,
  grading: bookCheck,
  grid_view: widget,
  group,
  group_share: groupShare,
  groups: group,
  help: question,
  history: clock,
  home,
  hourglass_top: hourglass,
  image,
  image_outline: image,
  how_to_vote: check,
  key,
  keyboard_arrow_down: arrowDown,
  keyboard_arrow_up: arrowTop,
  language: globe,
  layers,
  library_books: book,
  light_mode: sun,
  lightbulb: lamp,
  link,
  local_fire_department: fire,
  leaderboard: chart,
  lock,
  login: signIn,
  logout: signOut,
  low_priority: list,
  map,
  mark_email_unread: messageOpen,
  menu,
  menu_book: book,
  monitoring: chart,
  paid: money,
  more_horiz: more,
  more_vert: more,
  notifications: bell,
  notifications_none: bell,
  notifications_off: bell,
  open_in_new: external,
  palette: widget,
  person: user,
  photo_camera: camera,
  photo: image,
  play_arrow: play,
  poll: chart,
  priority_high: chield,
  public: globe,
  quiz: bookCheck,
  receipt_long: paper,
  refresh,
  remove,
  rocket_launch: star,
  route: road,
  save,
  school: bookOpen,
  schedule: clock,
  search,
  search_off: search,
  send,
  settings,
  share: groupShare,
  shield: chield,
  slideshow: videoFile,
  stadia_controller: gamepad,
  star,
  style: layers,
  support_agent: message,
  chat: comment,
  chat_bubble: comment,
  chat_bubble_outline: comment,
  favorite: thumbUp,
  swap_vert: list,
  target,
  task_alt: check,
  thumb_up: thumbUp,
  workspace_premium: trophy,
  trophy,
  tune: filter,
  timer: clock,
  verified: check,
  verified_user: chield,
  view_list: list,
  view_kanban: widget,
  visibility_off: hideEye,
  visibility: eye,
  volunteer_activism: groupShare,
  volume_off: soundMute,
  volume_up: soundMax,
  warning: chield,
  calendar_month: calendar,
};

interface LetsIconProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  name: string;
  size?: number;
  label?: string;
}

export function LetsIcon({
  name,
  size = 20,
  className,
  style,
  label,
  ...props
}: LetsIconProps) {
  const fallback = !icons[name];
  const source = icons[name] ?? question;
  // Trusted local assets from Lets Icons: rendering the SVG itself preserves
  // currentColor without relying on masks that can degrade into solid squares.
  const markup = source.replace(
    "<svg ",
    '<svg width="100%" height="100%" focusable="false" style="display:block" ',
  );

  return (
    <span
      {...props}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : props.role}
      className={["lets-icon", className].filter(Boolean).join(" ")}
      data-lets-icon={name}
      data-lets-fallback={fallback || undefined}
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
