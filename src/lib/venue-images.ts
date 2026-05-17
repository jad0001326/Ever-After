const representativeImages = {
  Castle: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1600&q=82",
  Barn: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=82",
  "Luxury Hotel": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=82",
  "Country Estate": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82"
};

export function representativeImageForType(type?: string) {
  return representativeImages[type as keyof typeof representativeImages] ?? representativeImages["Country Estate"];
}
