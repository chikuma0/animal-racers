import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/Game'), { 
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-b from-green-800 via-green-600 to-emerald-500 flex flex-col items-center justify-center text-white">
      <div className="text-6xl animate-spin">🏎️</div>
      <p className="mt-4 text-xl font-bold animate-pulse">Loading...</p>
    </div>
  ),
});

export default function Home() {
  return <Game />;
}
