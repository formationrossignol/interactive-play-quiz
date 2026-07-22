// src/components/presentation-editor/utils/__tests__/mediaRepo.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateMediaFile, uploadPresentationMedia, MediaValidationError } from "../mediaRepo";

const { uploadMock, getPublicUrlMock } = vi.hoisted(() => {
  const uploadMock = vi.fn();
  const getPublicUrlMock = vi.fn();
  return { uploadMock, getPublicUrlMock };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })),
    },
  },
}));

function fakeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

beforeEach(() => {
  uploadMock.mockClear();
  getPublicUrlMock.mockClear();
});

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

describe("uploadPresentationMedia", () => {
  it("rejects an invalid file with MediaValidationError before attempting upload", async () => {
    const invalidFile = fakeFile("a.exe", "application/x-msdownload", 1024);

    await expect(uploadPresentationMedia("user-1", "pres-1", "elem-1", invalidFile))
      .rejects.toThrow(MediaValidationError);

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("on successful upload, calls upload with expected path and returns public URL", async () => {
    const file = fakeFile("test.png", "image/png", 1024);

    uploadMock.mockResolvedValueOnce({ error: null });
    getPublicUrlMock.mockReturnValueOnce({
      data: { publicUrl: "https://example.com/user-1/pres-1/elem-1.png" },
    });

    const url = await uploadPresentationMedia("user-1", "pres-1", "elem-1", file);

    expect(uploadMock).toHaveBeenCalledOnce();
    expect(uploadMock).toHaveBeenCalledWith("user-1/pres-1/elem-1.png", file, {
      upsert: true,
      contentType: "image/png",
    });
    expect(url).toBe("https://example.com/user-1/pres-1/elem-1.png");
  });

  it("throws when the mocked upload returns an error", async () => {
    const file = fakeFile("test.png", "image/png", 1024);
    const uploadError = new Error("Upload failed");

    uploadMock.mockResolvedValueOnce({ error: uploadError });

    await expect(uploadPresentationMedia("user-1", "pres-1", "elem-1", file))
      .rejects.toThrow("Upload failed");
  });
});
