export interface ModeCardItem {
  id: string;
  tag: string;
  title: string;
  description: string;
  path: string;
}

export const MODE_CARDS: ModeCardItem[] = [
  {
    id: "standard",
    tag: "STANDARD",
    title: "Standard Mode",
    description: "Configure TX/RX channels, edit words, test avionics LRUs.",
    path: "/standard",
  },
  {
    id: "cfds",
    tag: "CFDS",
    title: "CFDS Mode",
    description: "Centralized Fault Display System (ABD0018 / ABD0048).",
    path: "/cfds",
  },
  {
    id: "cmc",
    tag: "CMC",
    title: "CMC Mode",
    description: "Central Maintenance Computer (Boeing).",
    path: "/cmc",
  },
  {
    id: "library",
    tag: "LIBRARY",
    title: "Label Library",
    description: "Aeroflex T1200 label dictionary (octal, name, default, units).",
    path: "/library",
  },
];

interface ModeSelectPageProps {
  onSelectMode: (path: string) => void;
}

export function ModeSelectPage({ onSelectMode }: ModeSelectPageProps) {
  return (
    <div className="mode-select-page">
      <div className="carousel-wrapper">
        <button
          type="button"
          className="carousel-arrow left"
          aria-label="Previous mode"
          title="Previous"
        >
          &lsaquo;
        </button>

        <div className="mode-select-content">
          <div className="hero-heading">
            <h1 className="hero-title">
              ATE <span className="teal-text">429</span> Console
            </h1>
            <p className="hero-subtitle">Select operating mode</p>
          </div>

          <div className="cards-grid">
            {MODE_CARDS.map((card) => (
              <div
                key={card.id}
                className="mode-card"
                onClick={() => onSelectMode(card.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectMode(card.path);
                  }
                }}
              >
                <div className="card-tag">{card.tag}</div>
                <h3 className="card-title">{card.title}</h3>
                <p className="card-description">{card.description}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="carousel-arrow right"
          aria-label="Next mode"
          title="Next"
        >
          &rsaquo;
        </button>
      </div>
    </div>
  );
}

