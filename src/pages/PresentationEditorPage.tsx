import { useSearchParams } from "react-router-dom";
import { PresentationEditor } from "@/components/presentation-editor/PresentationEditor";
import { getCurrentUser } from "@/lib/auth";

const PresentationEditorPage = () => {
  const [searchParams] = useSearchParams();
  const contentId = searchParams.get("id");
  const presentParam = searchParams.get("present") === "1";
  const user = getCurrentUser();
  if (!user) return null;
  return <PresentationEditor key={contentId ?? "new"} contentId={contentId} userId={user.id} initialPresenting={presentParam} />;
};

export default PresentationEditorPage;
