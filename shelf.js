export const shelf = [
  {
    id: "LXb3EKWsInQ",
    title: "Costa Rica in 4K",
    channel: "Jacob + Katie Schwarz",
    topic: "Nature",
    image: "/nature.jpg",
    terms: "wild wildlife rainforest landscapes forest mountains travel",
  },
  {
    id: "pSHVbLPWA28",
    title: "Black Holes 101",
    channel: "National Geographic",
    topic: "Space",
    image: "/space.jpg",
    terms: "astronomy universe cosmos science stars",
  },
  {
    id: "z0NgUhEs1R4",
    title: "Japan in 8K",
    channel: "Jacob + Katie Schwarz",
    topic: "Travel",
    image: "/japan.jpg",
    terms: "tokyo japan city street culture travel",
  },
];
export function starterSearch(query) {
  const words = query.toLowerCase().match(/[a-z0-9]+/g) || [];
  return shelf
    .map((video) => ({
      video,
      score: words.filter(
        (w) =>
          w.length > 2 &&
          (video.title + " " + video.topic + " " + video.terms)
            .toLowerCase()
            .includes(w),
      ).length,
    }))
    .filter((x) => x.score)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.video);
}
