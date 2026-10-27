"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_inr: number;
  image_url: string | null;
};

type ProductCard = Product & {
  tag: string;
  items: string[];
  style: string;
};

const productDetails: Record<
  string,
  Pick<ProductCard, "tag" | "items" | "style">
> = {
  "essential-hug": {
    tag: "A little care",
    items: [
      "Premium chocolate",
      "Comfort essentials",
      "Personal note",
    ],
    style: "essential",
  },
  "complete-hug": {
    tag: "Most loved",
    items: [
      "Chocolate & snacks",
      "Reusable heat pack",
      "Mini plushie",
      "Period essentials",
    ],
    style: "complete",
  },
  "premium-hug": {
    tag: "The full experience",
    items: [
      "Premium treats",
      "Cozy heat pack",
      "Cute teddy bear",
      "Personalized gift note",
    ],
    style: "premium",
  },
};


const contents = [
  { number: "01", title: "Sweet treats", detail: "Chocolate for little happy moments", icon: "♡" },
  { number: "02", title: "Warm comfort", detail: "A cozy reusable heat pack", icon: "☼" },
  { number: "03", title: "Thoughtful care", detail: "Period essentials for your needs", icon: "✿" },
  { number: "04", title: "A personal touch", detail: "A message made just for her", icon: "♡" },
  { number: "05", title: "Little joys", detail: "Snacks and a cuddly companion", icon: "☆" },
];

export default function Home() {
  
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");

        if (!response.ok) {
          throw new Error("Could not load products.");
        }

        const result: { products: Product[] } =
          await response.json();

        const cards = result.products.map((product) => ({
          ...product,
          ...(productDetails[product.slug] ?? {
            tag: "Made with love",
            items: [],
            style: "essential",
          }),
        }));

        setProducts(cards);
      } catch {
        setProductsError(
          "We couldn't load our gift boxes. Please try again."
        );
      } finally {
        setProductsLoading(false);
      }
    }

    loadProducts();
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff8f3] text-[#58352e]">
      <div className="announcement">
        A LITTLE EXTRA LOVE, DELIVERED TO HER DOORSTEP
      </div>

      <header className="site-header">
        <a href="#" className="brand" aria-label="Little Hug home">
          <span className="brand-mark">L<span>H</span></span>
          <span className="brand-name">Little Hug<small>CARE, WRAPPED WITH LOVE</small></span>
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#shop">Shop</a>
          <a href="#story">Our Story</a>
          <a href="#inside">What&apos;s Inside</a>
          <a href="#reviews">Reviews</a>
        </nav>

        <a href="#shop" className="header-button">Shop the boxes ↗</a>
      </header>

      <section id="home" className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span /> THE PERIOD CARE GIFT BOX</span>
          <h1>A little care.<br />A little comfort.<br /><em>A lot of love.</em></h1>
          <p>
            Because she deserves extra love on every kind of day.
            Thoughtfully curated period care boxes to make her feel
            cared for, cozy, and never alone.
          </p>
          <div className="hero-actions">
            <a href="#shop" className="button-primary">Find her perfect hug <span>↗</span></a>
            <a href="#story" className="button-text">Our little story →</a>
          </div>

          <div className="hero-benefits">
            <div><span>♡</span><p>Made with care</p></div>
            <div><span>✿</span><p>Thoughtfully curated</p></div>
            <div><span>♧</span><p>Perfect for gifting</p></div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-decoration decoration-one">✿</div>
          <div className="hero-decoration decoration-two">♡</div>
          <div className="hero-card">
            <span className="card-kicker">A GIFT THAT SAYS</span>
            <div className="gift-heart">♡</div>
            <div className="gift-logo">Little Hug</div>
            <div className="gift-subtitle">PERIOD CARE BOX</div>
            <div className="gift-flower">✿</div>
            <p>A little care.<br />A little comfort.<br />A lot of love.</p>
            <div className="gift-ribbon" />
            <div className="gift-seal">With love ♡</div>
          </div>
          <div className="floating-note">
            <span>♡</span>
            <p>Hey beautiful,</p>
            <small>You are loved<br />more than you know.</small>
          </div>
          <div className="hero-caption">A LITTLE BOX FULL OF BIG FEELINGS</div>
        </div>
      </section>

      <section className="trust-strip">
        <div><span>♡</span> Comfort you can feel</div>
        <div><span>✿</span> Thoughtfully selected</div>
        <div><span>♧</span> Made for gifting</div>
        <div><span>✧</span> Packed with love</div>
      </section>

      <section id="shop" className="shop-section section-padding">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A HUG FOR EVERY NEED</span>
            <h2>Find your kind of <em>comfort.</em></h2>
            <p>Three little ways to remind her she matters.</p>
          </div>
          <span className="handwritten">Made with love, always ♡</span>
        </div>

        <div className="product-grid">
          {productsLoading && <p>Preparing your Little Hugs...</p>}

{productsError && <p role="alert">{productsError}</p>}
          {products.map((product) => (
            <article className={`product-card ${product.style}`} key={product.name}>
              <div className="product-art">
                <span className="product-tag">{product.tag}</span>
                <div className="product-art-flower">✿</div>
                <div className="mini-box">
                  <div className="mini-box-heart">♡</div>
                  <div className="mini-box-logo">Little Hug</div>
                  <small>PERIOD CARE BOX</small>
                  <div className="mini-box-ribbon" />
                </div>
                <div className="product-prop prop-one">♡</div>
                <div className="product-prop prop-two">✿</div>
              </div>

              <div className="product-info">
                <span className="product-number">LITTLE HUG / {String(products.indexOf(product) + 1).padStart(2, "0")}</span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <ul>
                  {product.items.map((item) => <li key={item}><span>✓</span>{item}</li>)}
                </ul>
                <div className="product-bottom">
                  <div><small>YOUR LITTLE HUG</small><strong>₹{product.price_inr}</strong></div>
                  <a href={`/checkout?box=${encodeURIComponent(product.name)}`} className="product-button" aria-label={`Order ${product.name}`}>Choose box ↗</a>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="price-note">Thoughtfully packed. Beautifully gifted. Prices shown in INR.</p>
      </section>

      <section id="inside" className="inside-section section-padding">
        <div className="inside-intro">
          <span className="eyebrow">THE LITTLE THINGS MATTER</span>
          <h2>More than a box.<br /><em>It&apos;s a warm hug.</em></h2>
          <p>
            Every little detail is chosen with one thing in mind:
            helping her feel comfortable, supported, and loved.
          </p>
          <a href="#shop" className="button-text">Find her perfect box →</a>
        </div>
        <div className="contents-grid">
          {contents.map((item) => (
            <article className="content-item" key={item.number}>
              <span className="content-icon">{item.icon}</span>
              <div>
                <span className="content-number">{item.number} / LITTLE JOYS</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="story" className="story-section">
        <div className="story-art">
          <span className="story-sun">☼</span>
          <span className="story-flower">✿</span>
          <div className="story-message">You deserve<br />to be cared<br />for, too. <span>♡</span></div>
          <div className="story-stamp">A LITTLE<br />REMINDER<br />FOR YOU</div>
        </div>
        <div className="story-copy">
          <span className="eyebrow">A NOTE FROM US TO YOU</span>
          <h2>Because care<br />should feel like <em>love.</em></h2>
          <p>
            Periods can bring uncomfortable days, unexpected moods,
            and moments when a little kindness means everything.
          </p>
          <p>
            Little Hug was imagined as a thoughtful reminder that
            no one should have to ask for a little extra care.
            Whether it&apos;s for your sister, best friend, partner,
            or yourself, there&apos;s a hug for everyone.
          </p>
          <a href="#shop" className="button-primary">Send a little love ↗</a>
        </div>
      </section>

      <section id="reviews" className="reviews-section section-padding">
        <span className="eyebrow">LOVE NOTES</span>
        <h2>Little boxes, <em>big feelings.</em></h2>
        <p className="reviews-subtitle">Because the smallest gestures stay with us.</p>
        <div className="review-grid">
          <article className="review-card">
            <div className="review-stars">★★★★★</div>
            <p>&ldquo;Such a thoughtful surprise. The little details made it feel so personal and special.&rdquo;</p>
            <span className="review-author">A happy gift-giver</span>
          </article>
          <article className="review-card">
            <div className="review-stars">★★★★★</div>
            <p>&ldquo;I loved the idea. It&apos;s a lovely way to remind someone you&apos;re there for them.&rdquo;</p>
            <span className="review-author">A little hug recipient</span>
          </article>
          <article className="review-card">
            <div className="review-stars">★★★★★</div>
            <p>&ldquo;Beautifully thought out and full of warmth. It feels like a hug in a box.&rdquo;</p>
            <span className="review-author">A happy customer</span>
          </article>
        </div>
        <p className="review-disclaimer">Sample testimonials for the design preview. Replace with verified customer reviews before launch.</p>
      </section>

      <section className="closing-banner">
        <div><span className="eyebrow">SOME DAYS NEED A LITTLE EXTRA LOVE</span><h2>Send someone a <em>Little Hug.</em></h2></div>
        <a href="#shop" className="button-light">Explore the boxes ↗</a>
        <span className="closing-flower">✿</span>
      </section>

      <footer className="site-footer">
        <a href="#home" className="brand footer-brand">
          <span className="brand-mark">L<span>H</span></span>
          <span className="brand-name">Little Hug<small>CARE, WRAPPED WITH LOVE</small></span>
        </a>
        <p>A little care. A little comfort. A lot of love.</p>
        <nav aria-label="Footer navigation">
          <a href="#shop">Shop</a>
          <a href="#story">Our story</a>
          <a href="#inside">What&apos;s inside</a>
          <a href="mailto:hello@littlehug.example">Contact</a>
        </nav>
        <div className="footer-bottom"><span>© 2026 Little Hug</span><span>Made thoughtfully, with love ♡</span></div>
      </footer>
    </main>
  );
}
