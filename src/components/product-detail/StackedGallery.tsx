import type { ReactNode } from "react";
import { Play } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";

/**
 * Product page gallery, version `stacked` (desktop): every photo at full
 * column width, one under the other, so texture and finish can be read without
 * clicking through thumbnails. Each photo opens the page's full-screen viewer at
 * its own position (`onOpen(index)`); a video, when there is one, is a poster
 * tile after the photos that opens the same viewer at the video.
 *
 * The viewer pages through photos first and videos after, so the video's index
 * is `images.length`. Other videos stay reachable with the viewer's arrows.
 */
export interface StackedGalleryProps {
  images: string[];
  title: string;
  onOpen: (index: number) => void;
  /** The product's first video as stored: "yt:<id>" for YouTube, otherwise a file URL. */
  videoUrl?: string;
  /** Wishlist and share buttons, laid over the top-right corner of the first photo. */
  overlay?: ReactNode;
}

// Stays 1px-outlined on hover like the Classic main photo; the keyboard ring comes from the global :focus-visible rule.
const TILE = "group tile-img !rounded-card relative block w-full cursor-pointer overflow-hidden md:cursor-zoom-in";
const HOVER_RING =
  "pointer-events-none absolute inset-0 hidden rounded-card ring-1 ring-inset ring-primary/0 transition-shadow duration-hover ease-out group-hover:ring-primary/30 md:block";

/** YouTube gives a still for any video; a file URL has none, so the first photo stands in for it. */
const posterFor = (videoUrl: string, fallback: string | undefined) =>
  videoUrl.startsWith("yt:") ? `https://img.youtube.com/vi/${videoUrl.slice(3)}/mqdefault.jpg` : fallback;

export const StackedGallery = ({ images, title, onOpen, videoUrl, overlay }: StackedGalleryProps) => (
  <div className="flex flex-col gap-3">
    {images.map((src, index) => (
      <div key={`${index}-${src}`} className="relative">
        <button
          type="button"
          onClick={() => onOpen(index)}
          aria-label={`Open photo ${index + 1} of ${images.length}`}
          className={`${TILE} aspect-square`}
        >
          <SmartImage
            src={src}
            alt={images.length > 1 ? `${title}, photo ${index + 1}` : title}
            preset="detail"
            priority={index === 0}
            className="h-full w-full object-cover"
          />
          <span aria-hidden="true" className={HOVER_RING} />
        </button>
        {/* After the first photo's button in the DOM, so Tab runs photo, wishlist, share, next photo. */}
        {index === 0 && overlay && (
          <div className="absolute right-3 top-3 z-raised flex flex-col gap-2">{overlay}</div>
        )}
      </div>
    ))}

    {videoUrl && (
      <button
        type="button"
        onClick={() => onOpen(images.length)}
        aria-label={`Play video of ${title}`}
        className={`${TILE} aspect-video`}
      >
        <SmartImage src={posterFor(videoUrl, images[0])} alt="" preset="detail" className="h-full w-full object-cover" />
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-charcoal/20 transition-colors duration-hover ease-out group-hover:bg-charcoal/30"
        >
          <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-press ease-out group-active:scale-[0.97]">
            <Play className="ml-1 size-6 fill-current" />
          </span>
        </span>
      </button>
    )}
  </div>
);

export default StackedGallery;
