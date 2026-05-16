insert into public.amenities (slug, name) values
  ('exclusive-use', 'Exclusive use'),
  ('accommodation', 'Guest accommodation'),
  ('licensed', 'Licensed ceremony spaces'),
  ('catering', 'In-house catering'),
  ('gardens', 'Landscaped gardens'),
  ('pets', 'Pet friendly'),
  ('parking', 'Private parking'),
  ('late-license', 'Late licence')
on conflict (slug) do nothing;

insert into public.venues (
  slug, name, type, region, town, summary, description, price_from, price_to,
  capacity_min, capacity_max, hero_image, latitude, longitude, is_featured, status
) values
  (
    'ardencairn-castle',
    'Ardencairn Castle',
    'Castle',
    'Argyll and Bute',
    'Inveraray',
    'A private lochside castle with candlelit halls, terraced gardens, and full weekend hire.',
    'Ardencairn Castle is made for couples who want old-world drama without losing modern comfort.',
    9200,
    18500,
    40,
    160,
    'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1600&q=82',
    56.2306,
    -5.0737,
    true,
    'published'
  ),
  (
    'brae-and-thistle-barn',
    'Brae & Thistle Barn',
    'Barn',
    'Perthshire',
    'Crieff',
    'A restored stone barn with meadow ceremonies, fire pits, and a relaxed countryside feel.',
    'Set between rolling farmland and birch woods, Brae & Thistle Barn is a flexible blank canvas for design-led celebrations.',
    5200,
    9800,
    30,
    120,
    'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=82',
    56.372,
    -3.84,
    true,
    'published'
  ),
  (
    'the-calder-hotel',
    'The Calder Hotel',
    'Luxury Hotel',
    'Edinburgh',
    'Edinburgh',
    'A five-star Georgian hotel with rooftop views, polished service, and city-centre convenience.',
    'The Calder Hotel brings a luxury travel sensibility to wedding hosting with refined suites and a grand ballroom.',
    11000,
    26000,
    50,
    220,
    'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=82',
    55.9533,
    -3.1883,
    true,
    'published'
  )
on conflict (slug) do nothing;
