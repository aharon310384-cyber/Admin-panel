"use client";

// Звёздочка рядом с заголовком страницы — как в 1С: добавить страницу в избранное или убрать.
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/components/layout/favorites-context";

export default function FavoriteStar() {
  const favorites = useFavorites();
  if (!favorites) return null;
  const on = favorites.isCurrentFavorite;
  const label = on ? "Убрать из избранного" : "Добавить в избранное";
  return (
    <button
      type="button"
      className={cn("fav-star", on && "fav-star--on")}
      onClick={favorites.toggleCurrent}
      title={label}
      aria-label={label}
      aria-pressed={on}
    >
      <Star size={17} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
