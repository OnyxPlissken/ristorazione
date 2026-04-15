export const demoLocations = [
  {
    slug: "milano-brera",
    name: "Casa Brera",
    city: "Milano",
    metrics: {
      covers: 124,
      qrConversion: 63,
      avgTicket: 42,
      openTables: 5,
      revenue: 5180
    }
  },
  {
    slug: "roma-centro",
    name: "Teatro Roma",
    city: "Roma",
    metrics: {
      covers: 96,
      qrConversion: 51,
      avgTicket: 39,
      openTables: 7,
      revenue: 4110
    }
  },
  {
    slug: "napoli-lungomare",
    name: "Lungomare Napoli",
    city: "Napoli",
    metrics: {
      covers: 138,
      qrConversion: 58,
      avgTicket: 37,
      openTables: 4,
      revenue: 4720
    }
  }
];

export const demoSignals = [
  {
    kicker: "Reservation engine",
    title: "Seat guests by constraints, not by gut feeling",
    body: "Model capacity, duration, dining areas, and waitlists before adding optimization."
  },
  {
    kicker: "Table ordering",
    title: "Guests scan once and keep a live shared cart",
    body: "Orders stay tied to the table session, with optional item-level split bill."
  },
  {
    kicker: "Growth layer",
    title: "Turn service data into marketing triggers",
    body: "Move reservation, visit, and order events into CRM workflows for repeat traffic."
  }
];

export const demoModules = [
  {
    kicker: "Floor",
    title: "Reservations and table orchestration",
    body: "Host stand tools for bookings, walk-ins, waitlist handling, and table assignment.",
    points: ["Multi-location calendars", "Dining areas and shift windows", "Seat-aware occupancy"]
  },
  {
    kicker: "Service",
    title: "Guest ordering and pay-at-table",
    body: "QR sessions allow menu browsing, seat-tagged ordering, cart sync, and direct payments.",
    points: ["Seat-based split bill", "Modifier-ready menu model", "Faster turn times"]
  },
  {
    kicker: "Kitchen",
    title: "One queue for dine-in, takeaway, and delivery",
    body: "Route all incoming orders through a common operational lane with clear status signals.",
    points: ["Kitchen display workflow", "Channel-normalized orders", "Prep-time visibility"]
  }
];

export const demoReservations = [
  { id: "r1", guest: "M. Bianchi", location: "Casa Brera", table: "12", time: "19:15" },
  { id: "r2", guest: "L. Rossi", location: "Teatro Roma", table: "08", time: "19:30" },
  { id: "r3", guest: "C. Esposito", location: "Lungomare Napoli", table: "15", time: "20:00" },
  { id: "r4", guest: "A. Serra", location: "Casa Brera", table: "07", time: "20:15" }
];

export const demoKitchenQueue = [
  {
    id: "k1",
    table: "Casa Brera / T12",
    items: ["Tuna crudo", "Lemon risotto"],
    status: "plating"
  },
  {
    id: "k2",
    table: "Roma / Delivery #442",
    items: ["Rigatoni", "Focaccia", "Tiramisu"],
    status: "firing"
  },
  {
    id: "k3",
    table: "Napoli / T05",
    items: ["Octopus", "Sea bass"],
    status: "ready"
  }
];

export const demoDeliveryOrders = [
  {
    id: "d1",
    platform: "Uber Eats",
    location: "Casa Brera",
    customer: "Via Solferino",
    status: "driver assigned"
  },
  {
    id: "d2",
    platform: "Glovo",
    location: "Teatro Roma",
    customer: "Via Veneto",
    status: "preparing"
  },
  {
    id: "d3",
    platform: "Takeaway direct",
    location: "Lungomare Napoli",
    customer: "Pickup at 20:10",
    status: "ready for pickup"
  }
];

export const qrMenu = [
  {
    id: "m1",
    category: "Raw bar",
    name: "Amberjack crudo",
    description: "Citrus oil, pink pepper, fennel ash.",
    price: 18
  },
  {
    id: "m2",
    category: "Pasta",
    name: "Lemon risotto",
    description: "Aged rice, Amalfi lemon, smoked butter.",
    price: 22
  },
  {
    id: "m3",
    category: "Grill",
    name: "Charred sea bass",
    description: "Roasted greens, caper emulsion, grilled lemon.",
    price: 28
  },
  {
    id: "m4",
    category: "Dessert",
    name: "Olive oil cake",
    description: "Citrus cream, sea salt crumble.",
    price: 11
  }
];

export const demoTables = [
  {
    id: "milano-12",
    label: "12",
    location: "Casa Brera",
    status: "service active",
    server: "Anna / floor lead",
    seats: [
      { id: "s1", label: "Guest 1" },
      { id: "s2", label: "Guest 2" },
      { id: "s3", label: "Guest 3" }
    ]
  },
  {
    id: "roma-8",
    label: "08",
    location: "Teatro Roma",
    status: "awaiting guests",
    server: "Luca / host",
    seats: [
      { id: "s1", label: "Guest 1" },
      { id: "s2", label: "Guest 2" }
    ]
  }
];

export function getTableSession(tableId) {
  return demoTables.find((table) => table.id === tableId);
}
