// src/components/presentation-editor/utils/__tests__/mediaRepo.test.ts
import { describe, it, expect, vi } from "vitest";
import { validateMediaFile } from "../mediaRepo";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  },
}));

function fakeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

describe("validateMediaFile", () => {
  it("accepts a small png", () => {
    expect(validateMediaFile(fakeFile("a.png", "image/png", 1024))).toEqual({ ok: true });
  });
  it("accepts a small mp4", () => {
    expect(validateMediaFile(fakeFile("a.mp4", "video/mp4", 1024))).toEqual({ ok: true });
  });
  it("rejects an unsupported type", () => {
    expect(validateMediaFile(fakeFile("a.exe", "application/x-msdownload", 1024))).toEqual({
      ok: false, error: "Type de fichier non supporté.",
    });
  });
  it("rejects an image over 10MB", () => {
    expect(validateMediaFile(fakeFile("a.png", "image/png", 11 * 1024 * 1024))).toEqual({
      ok: false, error: "Image trop volumineuse (max 10 Mo).",
    });
  });
  it("rejects a video over 50MB", () => {
    expect(validateMediaFile(fakeFile("a.mp4", "video/mp4", 51 * 1024 * 1024))).toEqual({
      ok: false, error: "Vidéo trop volumineuse (max 50 Mo).",
    });
  });
});
