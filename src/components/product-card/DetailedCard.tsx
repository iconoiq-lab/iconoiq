import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingCart, Star, Truck } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { WishlistToggle } from "@/components/WishlistToggle";
import { DealerPriceInline } from "@/components/dealer/DealerPrice";
import { formatINR } from "@/lib/format";
import { useFreeDeliveryAbove } from "@/hooks/useFreeDeliveryAbove";
import { cn } from "@/lib/utils";
import type { CardActions, Product } from "@/components/ProductCard";

interface CardBodyProps {
  product: Product;
  actions: CardActions;
  /** The first cards on a page load their photo eagerly. */
  priority?: boolean;
}

/**
 * Real stars from the product's reviews (`rating` and `reviews` are kept by
 * reviewService). No reviews yet: five empty stars and no number, so the row
 * never claims a rating and every card keeps the same height.
 */
const CardRating = ({ rating, reviews, title }: { rating: number; reviews: number; title: string }) => {
  const rated = reviews > 0;
  return (
    <div className="flex items-center gap-0.5">
      <span className="sr-only">
        {rated ? `${title}: rated ${rating.toFixed(1)} out of 5 from ${reviews} reviews` : "No reviews yet"}
      </span>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={cn(
            "size-3.5",
            rated && i < Math.round(rating) ? "fill-highlight-soft text-highlight-soft" : "fill-transparent text-foreground/30",
          )}
        />
      ))}
      {rated && (
        <span aria-hidden="true" className="ml-1 text-xs tabular-nums text-muted-foreground">
          {rating.toFixed(1)} ({reviews})
        </span>
      )}
    </div>
  );
};

/**
 * Detailed: a square photo with the wishlist heart on it, the category, the
 * name, the star row, one detail line (the product's short spec; without one,
 * "Free delivery" when this item alone reaches the store's free-delivery
 * amount; otherwise nothing), the price, then a cart button beside Buy now.
 * Once the item is in the cart the cart button becomes a small quantity
 * stepper. Buy now adds it (if needed) and goes straight to checkout. A very
 * narrow card tightens its buttons (container queries follow the card's width).
 */
const DetailedCard = ({ product, actions, priority = false }: CardBodyProps) => {
  const { href, inCartQty, displayPrice, displayDiscount, displayOldPrice, dealer, saved, toggleSaved, handleAddToCart, handleBuyNow, decrease, increase } = actions;
  const soldOut = typeof product.stock === "number" && product.stock <= 0;
  const category = product.category?.trim();
  const freeAbove = useFreeDeliveryAbove();
  // A dealer pays their own unit price, so their card checks that price.
  const freeDelivery = !product.keyAttribute && freeAbove !== null && (dealer ? dealer.unit : displayPrice) >= freeAbove;

  return (
    <article
      className={cn(
        "card-product group relative flex h-full flex-col p-1.5 [container-type:inline-size] lg:p-2",
        "has-[a[data-card-link]:focus-visible]:outline has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-ring",
      )}
    >
      <div className="tile-img relative aspect-square overflow-hidden">
        <SmartImage
          src={product.image}
          alt={product.alt || product.title}
          className="h-full w-full object-cover transition-[transform,opacity] duration-reveal ease-out group-hover:scale-[1.03]"
          preset="card"
          priority={priority}
        />
        {product.isNew && <span className="tag-dark pointer-events-none absolute left-2 top-2">New</span>}
        <WishlistToggle
          name={product.title}
          saved={saved}
          onToggle={toggleSaved}
          size="sm"
          className="absolute right-1.5 top-1.5 z-raised lg:right-2 lg:top-2"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 px-0.5 pb-0.5 pt-2.5 [@container(min-width:220px)]:px-1.5">
        {category && (
          <span
            title={category}
            className="block truncate text-[10px] font-bold uppercase tracking-[0.16em] text-primary lg:tracking-[0.2em]"
          >
            {category}
          </span>
        )}
        <h3
          title={product.title}
          className="line-clamp-2 min-h-[2.6em] text-sm font-semibold leading-[1.3] text-foreground [text-wrap:pretty] lg:text-[15px]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <Link
            to={href}
            data-card-link=""
            className="outline-none after:absolute after:inset-0 after:rounded-card after:content-['']"
          >
            {product.title}
          </Link>
        </h3>
        <CardRating rating={product.rating ?? 0} reviews={product.reviews ?? 0} title={product.title} />
        {product.keyAttribute ? (
          <p className="line-clamp-1 text-xs leading-[1.4] text-muted-foreground">{product.keyAttribute}</p>
        ) : (
          freeDelivery && (
            <p className="flex items-center gap-1 text-xs leading-[1.4] text-muted-foreground">
              <Truck aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
              Free delivery
            </p>
          )
        )}

        <div className="mt-auto pt-1">
          {dealer ? (
            <DealerPriceInline unit={dealer.unit} regular={displayPrice} percentOff={dealer.percentOff} />
          ) : (
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
              <span className="price-now text-[15px] lg:text-lg">{formatINR(displayPrice)}</span>
              {displayOldPrice && (
                <span className="price-was text-xs lg:text-sm">
                  <span className="sr-only">Was </span>
                  {formatINR(displayOldPrice)}
                </span>
              )}
              {displayDiscount && <span className="chip-off">{displayDiscount}% off</span>}
            </p>
          )}
        </div>

        <div className="mt-2 flex items-stretch gap-1.5 [@container(max-width:150px)]:gap-1 lg:gap-2">
          {inCartQty > 0 ? (
            <div className="relative z-raised flex h-10 flex-none items-center overflow-hidden rounded-control border border-primary bg-primary/[0.06]">
              <button
                type="button"
                aria-label={`Decrease quantity of ${product.title}`}
                onClick={decrease}
                className="focus-inset grid h-10 w-8 place-items-center text-primary [@container(max-width:200px)]:w-7 transition-[background-color,transform] duration-press ease-out hover:bg-primary/10 active:scale-[0.94]"
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <span aria-live="polite" className="min-w-[1rem] text-center text-sm font-bold tabular-nums text-primary">
                {inCartQty}
                <span className="sr-only"> in cart</span>
              </span>
              <button
                type="button"
                aria-label={`Increase quantity of ${product.title}`}
                onClick={increase}
                className="focus-inset grid h-10 w-8 place-items-center text-primary [@container(max-width:200px)]:w-7 transition-[background-color,transform] duration-press ease-out hover:bg-primary/10 active:scale-[0.94]"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={soldOut}
              aria-label={`Add ${product.title} to cart`}
              onClick={handleAddToCart}
              className={cn(
                "relative z-raised grid size-10 flex-none place-items-center rounded-control border border-primary text-primary transition-[background-color,color,transform] duration-press ease-out hover:bg-primary hover:text-primary-foreground active:scale-[0.94]",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-primary disabled:active:scale-100",
              )}
            >
              <ShoppingCart aria-hidden="true" className="size-[18px]" />
            </button>
          )}
          <button
            type="button"
            disabled={soldOut}
            onClick={handleBuyNow}
            className={cn(
              "relative z-raised flex h-10 min-w-0 flex-1 items-center justify-center rounded-control border border-primary bg-primary px-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary-foreground transition-[background-color,border-color,transform] duration-press ease-out hover:border-primary-dark hover:bg-primary-dark active:scale-[0.97] dark:hover:border-primary-light dark:hover:bg-primary-light",
              "[@container(max-width:200px)]:tracking-[0.04em]",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
            )}
          >
            <span className="truncate">{soldOut ? "Sold out" : "Buy now"}</span>
            <span className="sr-only">: {product.title}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default DetailedCard;
