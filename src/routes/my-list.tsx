import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, X } from "lucide-react";
import { MovieCard, SiteShell } from "@/components/cinevault";
import type { Movie } from "@/lib/supabase";
import { fetchMoviesByIds } from "@/lib/api/server.movies";
import {
  loadMyList,
  removeFromMyList,
  subscribeMyList,
  type MyListItem,
} from "@/lib/myList";

export const Route = createFileRoute("/my-list")({
  head: () => ({
    title: "My List — CineVault",
    meta: [
      {
        name: "description",
        content: "Your saved CineVault titles — stored on this device, no account needed.",
      },
    ],
  }),
  component: MyListPage,
});

function MyListPage() {
  // F5: null = the on-device list has not been read yet. The empty
  // message may only render once resolution completes with zero items
  // — never as a first-paint flash while saved titles are loading.
  const [items, setItems] = useState<MyListItem[] | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const load = () => setItems(loadMyList());
    load();
    return subscribeMyList(load);
  }, []);

  // Hydrate snapshots into full rows so cards can play / show full meta.
  useEffect(() => {
    if (!items) return;
    if (!items.length) {
      setMovies([]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    let cancelled = false;
    const snapshots = items.map(
      (i) =>
        ({
          id: i.id,
          title: i.title,
          thumbnail: i.poster,
          banner: i.backdrop,
          year: i.year,
        }) as unknown as Movie,
    );
    fetchMoviesByIds({ data: { ids: items.map((i) => i.id) } })
      .then((r: any) => {
        if (cancelled) return;
        const byId = new Map<string, Movie>(
          ((r?.movies || []) as Movie[]).map((m) => [String(m.id), m]),
        );
        setMovies(items.map((i) => byId.get(i.id) || snapshots[items.indexOf(i)]));
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMovies(snapshots);
          setHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-24 md:px-8">
        <h1 className="flex items-center gap-2.5 text-2xl font-black text-white md:text-3xl">
          <Bookmark className="text-[#06B6D4]" /> My List
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Titles you save appear here — stored on this device, no account needed.
        </p>

        {items === null || !hydrated ? (
          /* F5: loading state until the list resolves — skeleton cards,
             never the empty message. */
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-label="Loading your list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-white/6" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 text-center">
            <Bookmark size={40} className="mx-auto text-slate-600" />
            <p className="mt-4 text-lg font-semibold text-white">Your list is empty</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
              Tap the + button on any title to save it here for later.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-md bg-[#06B6D4] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-400"
            >
              Browse titles
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {movies.map((m) => (
              <div key={String(m.id)} className="group relative">
                <MovieCard movie={m} />
                <button
                  type="button"
                  aria-label={`Remove ${m.title} from My List`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFromMyList(m.id);
                  }}
                  className="absolute -right-1.5 -top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-[#141414] text-white shadow-lg transition hover:border-red-400 hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
