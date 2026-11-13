import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminClient, requireAdminUser } from "@/lib/supabase.server";

const accessTokenSchema = z.object({
  accessToken: z.string().min(1),
});

const episodeLinkSchema = z.object({
  episode: z.number().int().min(1),
  title: z.string().nullable().optional(),
  link_480p: z.string().nullable().optional(),
  link_720p: z.string().nullable().optional(),
  link_1080p: z.string().nullable().optional(),
});

const moviePayloadSchema = z.object({
  title: z.string().min(1),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  language: z.string().nullable().optional(),
  quality: z.string().nullable().optional(),
  format: z.string().nullable().optional(),
  imdb_rating: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  banner: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  link_480p: z.string().nullable().optional(),
  link_720p: z.string().nullable().optional(),
  link_1080p: z.string().nullable().optional(),
  link_4k: z.string().nullable().optional(),
  is_trending: z.boolean().nullable().optional(),
  is_featured: z.boolean().nullable().optional(),
  screenshot_1: z.string().nullable().optional(),
  screenshot_2: z.string().nullable().optional(),
  screenshot_3: z.string().nullable().optional(),
  screenshot_4: z.string().nullable().optional(),
  screenshot_5: z.string().nullable().optional(),
  screenshot_6: z.string().nullable().optional(),
  screenshot_7: z.string().nullable().optional(),
  screenshot_8: z.string().nullable().optional(),
  screenshot_9: z.string().nullable().optional(),
  screenshot_10: z.string().nullable().optional(),
  screenshots: z.array(z.string()).nullable().optional(),
  type: z.string().nullable().optional(),
  season_number: z.number().nullable().optional(),
  total_episodes: z.number().nullable().optional(),
  episode_links: z.array(episodeLinkSchema).nullable().optional(),
  genre: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  file_size: z.string().nullable().optional(),
  director: z.string().nullable().optional(),
  cast_names: z.string().nullable().optional(),
});

const addMovieInput = accessTokenSchema.extend({ movie: moviePayloadSchema });
const editMovieInput = accessTokenSchema.extend({
  id: z.string().min(1),
  patch: moviePayloadSchema.partial(),
});
const deleteMovieInput = accessTokenSchema.extend({ id: z.string().min(1) });
const toggleFieldInput = accessTokenSchema.extend({
  id: z.string().min(1),
  value: z.boolean(),
});

export const checkAdminAccess = createServerFn({ method: "POST" })
  .validator(accessTokenSchema)
  .handler(async ({ data }) => {
    await requireAdminUser(data.accessToken);
    return { authorized: true };
  });

export const addMovie = createServerFn({ method: "POST" })
  .validator(addMovieInput)
  .handler(async ({ data }) => {
    await requireAdminUser(data.accessToken);
    const { data: inserted, error } = await adminClient
      .from("movies")
      .insert(data.movie)
      .select()
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return { movie: inserted };
  });

export const editMovie = createServerFn({ method: "POST" })
  .validator(editMovieInput)
  .handler(async ({ data }) => {
    await requireAdminUser(data.accessToken);
    const { data: updated, error } = await adminClient
      .from("movies")
      .update(data.patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return { movie: updated };
  });

export const deleteMovie = createServerFn({ method: "POST" })
  .validator(deleteMovieInput)
  .handler(async ({ data }) => {
    await requireAdminUser(data.accessToken);
    const { error } = await adminClient.from("movies").delete().eq("id", data.id);
    if (error) {
      throw new Error(error.message);
    }
    return { success: true };
  });

export const toggleTrending = createServerFn({ method: "POST" })
  .validator(toggleFieldInput)
  .handler(async ({ data }) => {
    await requireAdminUser(data.accessToken);
    const { data: updated, error } = await adminClient
      .from("movies")
      .update({ is_trending: data.value })
      .eq("id", data.id)
      .select()
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return { movie: updated };
  });

export const toggleFeatured = createServerFn({ method: "POST" })
  .validator(toggleFieldInput)
  .handler(async ({ data }) => {
    await requireAdminUser(data.accessToken);
    const { data: updated, error } = await adminClient
      .from("movies")
      .update({ is_featured: data.value })
      .eq("id", data.id)
      .select()
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return { movie: updated };
  });
