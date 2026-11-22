export const shelf = [
  {
    id: "LXb3EKWsInQ",
    title: "Costa Rica in 4K",
    channel: "Jacob + Katie Schwarz",
    description:
      "A scenic HDR film showcasing Costa Rican wildlife and landscapes.",
    duration: "PT5M14S",
    topic: "Nature",
    image: "/nature.jpg",
    terms: "wild wildlife rainforest landscapes forest mountains travel",
  },
  {
    id: "kOEDG3j1bjs",
    title: "Black Holes 101",
    channel: "National Geographic",
    description:
      "An introduction to types of black holes, how they form, and how scientists discovered them.",
    duration: "PT3M11S",
    topic: "Space",
    image: "/space.jpg",
    terms: "astronomy universe cosmos science stars",
  },
  {
    id: "nRt4Duf7GoI",
    title: "Snow Monkeys in Japan",
    channel: "Jacob + Katie Schwarz",
    description: "A wildlife film featuring Japan’s snow monkeys in 5K.",
    duration: "PT3M21S",
    topic: "Travel",
    image: "/japan.jpg",
    terms: "japan snow monkeys wildlife travel",
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

export function recommendationContext({
  id,
  title,
  channel,
  description,
  duration,
}) {
  return { id, title, channel, description, duration };
}
