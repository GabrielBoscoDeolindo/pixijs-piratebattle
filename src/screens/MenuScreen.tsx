const MENU_ASSET_PATH = '/ui/menu';

interface MenuScreenProps {
  onPlay: () => void;
  onOptions: () => void;
  onRanking: () => void;
  onHistory: () => void;
}

interface ImageButtonProps {
  children: string;
  kind?: 'primary' | 'secondary';
  onClick: () => void;
}

function ImageButton({
  children,
  kind = 'primary',
  onClick,
}: ImageButtonProps) {
  return (
    <button
      className={`menu-button menu-button--${kind}`}
      type="button"
      onClick={onClick}
    >
      <span>{children}</span>
    </button>
  );
}

export function MenuScreen({
  onPlay,
  onOptions,
  onRanking,
  onHistory,
}: MenuScreenProps) {
  return (
    <main className="main-menu">
      <section className="menu-panel" aria-labelledby="game-title">
        <img
          className="menu-title"
          id="game-title"
          src={`${MENU_ASSET_PATH}/title_pirate_battle.png`}
          alt="Pirate Battle"
        />

        <div className="menu-primary-actions">
          <ImageButton onClick={onPlay}>PLAY</ImageButton>
          <ImageButton onClick={onOptions}>
            OPTIONS
          </ImageButton>
        </div>

        <div className="menu-secondary-actions">
          <ImageButton
            kind="secondary"
            onClick={onRanking}
          >
            RANKING
          </ImageButton>
          <ImageButton
            kind="secondary"
            onClick={onHistory}
          >
            MATCH HISTORY
          </ImageButton>
        </div>

        <div className="menu-controls" aria-label="Keyboard controls">
          <span>W / ↑ Sail · A / D or ← / → Turn</span>
          <span>Space Front · Q / E Sides · Esc Pause</span>
        </div>
      </section>
    </main>
  );
}
