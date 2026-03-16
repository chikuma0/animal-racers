import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/Game'), { 
  ssr: false,
  loading: () => (
    <div className="game-shell !overflow-hidden">
      <div className="game-shell-inner flex min-h-screen items-center justify-center">
        <div className="game-panel w-full max-w-sm px-6 py-10 text-center">
          <div className="hero-badge mx-auto">Boot Sequence</div>
          <div className="hero-mark mt-5 text-5xl">🏁</div>
          <h1 className="hero-title text-center">Animal Racers</h1>
          <p className="hero-subtitle text-center">Loading arena, champions, and track telemetry.</p>
        </div>
      </div>
    </div>
  ),
});

export default function Home() {
  return <Game />;
}
