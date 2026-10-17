import { Link } from "react-router-dom";
import { Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { DealerPriceInline } from "@/components/dealer/DealerPrice";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CardActions, Product } from "@/components/ProductCard";

interface CardBodyProps {
  product: Product;
  actions: CardActions;
  /** The first cards on a page load their photo eagerly. */
  priority?: boolean;
}

/**
 * Detailed: a 4:5 photo, the category, the name, one key attribute (only when
 * the product has one), the price, then a full-width Add to cart beside a
 * square wishlist button. The bag icon appears once the card is 220px wide, and
 * a very narrow card tightens its buttons (container queries, so it follows the
 * card's width rather than the screen's).
 */
const DetailedCard = ({ product, actions, priority = false }: CardBodyProps) => {
  const { href, inCartQty, displayPrice, displayDiscount, displayOldPrice, dealer, saved, toggleSaved, handleAddToCart, decrease, increase } = actions;
  const soldOut = typeof product.stock === "number" && product.stock <= 0;
  const category = product.category?.trim();

  return (
    <article
      className={cn(
        "card-product group relative flex h-full flex-col p-1.5 [container-type:inline-size] lg:p-2",
        "has-[a[data-card-link]:focus-visible]:outline has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-ring",
      )}
    >
      <div className="tile-img relative aspect-[4/5] overflow-hidden">
        <SmartImage
          src={product.image}
          alt={product.alt || product.title}
          className="h-full w-full object-cover transition-[transform,opacity] duration-reveal ease-out group-hover:scale-[1.03]"
          preset="card"
          priority={priority}
        />
        {product.isNew && <span className="tag-dark pointer-events-none absolute left-2 top-2">New</span>}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-0.5 pb-0.5 pt-3 [@container(min-width:220px)]:px-1.5">
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
          className="line-clamp-2 text-sm font-semibold leading-[1.3] text-foreground [text-wrap:pretty] lg:text-[15px]"
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
        {product.keyAttribute && (
          <p className="line-clamp-1 text-xs leading-[1.4] text-muted-foreground">{product.keyAttribute}</p>
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
            <div className="relative z-raised flex h-10 min-w-0 flex-1 items-center justify-between overflow-hidden rounded-control border border-primary/40">
              <button
                type="button"
                aria-label={`Decrease quantity of ${product.title}`}
                onClick={decrease}
                className="focus-inset grid size-10 shrink-0 place-items-center text-foreground transition-[background-color,color,transform] duration-press ease-out hover:bg-muted hover:text-primary active:scale-[0.97]"
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <span aria-live="polite" className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-primary tabular-nums lg:text-[11px]">
                {inCartQty} in cart
              </span>
              <button
                type="button"
                aria-label={`Increase quantity of ${product.title}`}
                onClick={increase}
                className="focus-inset grid size-10 shrink-0 place-items-center text-foreground transition-[background-color,color,transform] duration-press ease-out hover:bg-muted hover:text-primary active:scale-[0.97]"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={soldOut}
              onClick={handleAddToCart}
              className={cn(
                "relative z-raised flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control border border-primary bg-primary px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-foreground transition-[background-color,border-color,color,transform] duration-press ease-out hover:border-primary-dark hover:bg-primary-dark active:scale-[0.97] dark:hover:border-primary-light dark:hover:bg-primary-light lg:text-[11px]",
                "[@container(min-width:220px)]:px-3 [@container(max-width:150px)]:px-0.5 [@container(max-width:150px)]:tracking-[0.04em]",
                "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
              )}
            >
              <ShoppingBag aria-hidden="true" className="hidden size-4 [@container(min-width:220px)]:inline" />
              {soldOut ? "Out of stock" : "Add to cart"}
              <span className="sr-only">: {product.title}</span>
            </button>
          )}
          <button
            type="button"
            aria-label={`Save ${product.title} to wishlist`}
            aria-pressed={saved}
            onClick={toggleSaved}
            className={cn(
              "relative z-raised grid size-10 flex-none place-items-center rounded-control border border-foreground/15 text-foreground transition-[border-color,color,transform] duration-press ease-out hover:border-primary active:scale-[0.97] [@container(max-width:150px)]:size-9",
              saved && "border-primary text-primary",
            )}
          >
            <Heart
              aria-hidden="true"
              className={cn("size-[18px] transition-[fill,color] duration-hover ease-out", saved ? "fill-current" : "fill-transparent")}
            />
          </button>
        </div>
      </div>
    </article>
  );
};

export default DetailedCard;
