import { useState } from "react";
import Draggable from "react-draggable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Type, Image as ImageIcon, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'shape';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  imageUrl?: string;
}

interface SlideCanvasProps {
  elements: SlideElement[];
  backgroundColor?: string;
  onChange: (elements: SlideElement[]) => void;
  editable?: boolean;
}

export const SlideCanvas = ({ elements, backgroundColor = '#ffffff', onChange, editable = true }: SlideCanvasProps) => {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const handleDrag = (id: string, data: { x: number; y: number }) => {
    const updatedElements = elements.map(el =>
      el.id === id ? { ...el, x: data.x, y: data.y } : el
    );
    onChange(updatedElements);
  };

  const handleContentChange = (id: string, content: string) => {
    const updatedElements = elements.map(el =>
      el.id === id ? { ...el, content } : el
    );
    onChange(updatedElements);
  };

  const handleDelete = (id: string) => {
    onChange(elements.filter(el => el.id !== id));
    setSelectedElementId(null);
  };

  const handleResize = (id: string, width: number, height: number) => {
    const updatedElements = elements.map(el =>
      el.id === id ? { ...el, width, height } : el
    );
    onChange(updatedElements);
  };

  return (
    <div 
      className="relative w-full h-[600px] border-2 border-border rounded-lg overflow-hidden"
      style={{ backgroundColor }}
      onClick={() => setSelectedElementId(null)}
    >
      {elements.map((element) => (
        <Draggable
          key={element.id}
          position={{ x: element.x, y: element.y }}
          onStop={(_, data) => handleDrag(element.id, { x: data.x, y: data.y })}
          disabled={!editable}
        >
          <div
            className={cn(
              "absolute cursor-move group",
              selectedElementId === element.id && "ring-2 ring-primary"
            )}
            style={{
              width: element.width,
              height: element.height,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (editable) setSelectedElementId(element.id);
            }}
          >
            {element.type === 'text' && (
              <div className="w-full h-full">
                {editable && selectedElementId === element.id ? (
                  <textarea
                    value={element.content}
                    onChange={(e) => handleContentChange(element.id, e.target.value)}
                    className="w-full h-full bg-transparent border-none resize-none p-2 focus:outline-none"
                    style={{
                      fontSize: element.fontSize || 16,
                      fontWeight: element.fontWeight || 'normal',
                      color: element.color || '#000000',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="w-full h-full p-2 whitespace-pre-wrap"
                    style={{
                      fontSize: element.fontSize || 16,
                      fontWeight: element.fontWeight || 'normal',
                      color: element.color || '#000000',
                    }}
                  >
                    {element.content}
                  </div>
                )}
              </div>
            )}

            {element.type === 'image' && element.imageUrl && (
              <img
                src={element.imageUrl}
                alt="Slide element"
                className="w-full h-full object-cover rounded"
              />
            )}

            {element.type === 'shape' && (
              <div
                className="w-full h-full rounded"
                style={{ backgroundColor: element.backgroundColor || '#3b82f6' }}
              />
            )}

            {editable && selectedElementId === element.id && (
              <div className="absolute -top-8 right-0 flex gap-1 bg-background border border-border rounded p-1 shadow-lg">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(element.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}

            {editable && selectedElementId === element.id && (
              <div
                className="absolute bottom-0 right-0 w-4 h-4 bg-primary cursor-nwse-resize"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startWidth = element.width;
                  const startHeight = element.height;

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    const deltaY = moveEvent.clientY - startY;
                    handleResize(
                      element.id,
                      Math.max(50, startWidth + deltaX),
                      Math.max(30, startHeight + deltaY)
                    );
                  };

                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            )}
          </div>
        </Draggable>
      ))}
    </div>
  );
};
