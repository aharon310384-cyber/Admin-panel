"use client";

// Избранное текущей страницы — для звёздочки рядом с заголовком страницы (её даёт AdminShell).
import { createContext, useContext } from "react";

export type FavoritesApi = { isCurrentFavorite: boolean; toggleCurrent: () => void };

export const FavoritesContext = createContext<FavoritesApi | null>(null);

export const useFavorites = () => useContext(FavoritesContext);
