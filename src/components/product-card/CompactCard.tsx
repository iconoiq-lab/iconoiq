import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { IconButton } from "@/components/ui/icon-button";
import { WishlistToggle } from "@/components/WishlistToggle";
import { DealerPriceInline } from "@/components/dealer/DealerPrice";
import { formatINR } from "@/lib/format";
import type { CardActions, Product } from "@/components/ProductCard";

interface CardBodyProps {
  product: Product;
  actions: CardActions;
  /** The first cards on a page load their photo eagerly. */
  priority?: boolean;
}

/**
 * Compact: a square photo, tight padding, one line of name and the price. The
 * round quick-add button sits on the photo (a quantity stepper once the item is
 * in the cart). No category, no stars.
 */
const CompactCard = ({ product, actions, priority = false }: CardBodyProps) => {
  const { href, inCartQty, displayPrice, displayOldPrice, dealer, saved, toggleSaved, handleAddToCart, decrease, increase } = actions;
  const soldOut = typeof product.stock === "number" && product.stock <= 0;

  return (
    <article
      className={
        "card-product group relative flex h-full flex-col p-1 " +
        "has-[a[data-card-link]:focus-visible]:outline has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2 has-[a[data-card-link]:focus-visible]:outline-ring"
      }
    >
      {/* The name comes first in the DOM (the photo is moved above it with order-first), so Tab reaches the title link, then the heart, then add. */}
      <div className="flex flex-1 flex-col gap-0.5 px-1 pb-1 pt-2">
        <h3
          title={product.title}
          className="truncate text-[13px] font-semibold leading-[1.3] text-foreground"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <Link
            to={href}
            data-card-link=""
            className="outline-none after:absolute after:inset-0 after:z-[1] after:rounded-card after:content-['']"
          >
            {product.title}
          </Link>
        </h3>
        {dealer ? (
          <DealerPriceInline unit={dealer.unit} regular={displayPrice} percentOff={dealer.percentOff} />
        ) : (
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className="price-now text-sm lg:text-base">{formatINR(displayPrice)}</span>
            {displayOldPrice && (
              <span className="price-was text-xs">
                <span className="sr-only">Was </span>
                {formatINR(displayOldPrice)}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="tile-img relative order-first aspect-square overflow-hidden">
        <SmartImage
          src={product.image}
          alt={product.alt || product.title}
          className="h-full w-full object-cover object-[50%_0] transition-[transform,opacity] duration-reveal ease-out group-hover:scale-[1.03]"
          preset="card"
          priority={priority}
        />
        {product.isNew && <span className="tag-dark pointer-events-none absolute left-1.5 top-3.5">New</span>}
        <WishlistToggle
          name={product.title}
          saved={saved}
          onToggle={toggleSaved}
          size="sm"
          className="absolute right-1.5 top-1.5 z-raised"
        />
        {inCartQty > 0 ? (
          <div className="absolute bottom-1.5 right-1.5 z-raised flex h-9 items-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card">
            <button
              type="button"
              aria-label={`Decrease quantity of ${product.title}`}
              onClick={decrease}
              className="grid size-9 place-items-center transition-[background-color,transform] duration-press ease-out hover:bg-primary-dark active:scale-[0.97] dark:hover:bg-primary-light"
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <span aria-live="polite" className="min-w-5 text-center text-xs font-bold tabular-nums">
              {inCartQty}
              <span className="sr-only"> in cart</span>
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${product.title}`}
              onClick={increase}
              className="grid size-9 place-items-center transition-[background-color,transform] duration-press ease-out hover:bg-primary-dark active:scale-[0.97] dark:hover:bg-primary-light"
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : (
          <IconButton
            label={soldOut ? `${product.title} is out of stock` : `Add ${product.title} to cart`}
            size="sm"
            disabled={soldOut}
            onClick={handleAddToCart}
            className="absolute bottom-1.5 right-1.5 z-raised border-transparent bg-primary text-primary-foreground shadow-md ring-2 ring-card hover:border-transparent hover:bg-primary-dark hover:text-primary-foreground dark:hover:bg-primary-light"
          >
            <Plus aria-hidden="true" className="stroke-2" />
          </IconButton>
        )}
      </div>
    </article>
  );
};

export default CompactCard;
