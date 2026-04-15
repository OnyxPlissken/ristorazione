import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();
const defaultRolePermissions = {
  ADMIN: {
    canViewDashboard: true,
    canViewLocations: true,
    canManageLocations: true,
    canViewTables: true,
    canManageTables: true,
    canDeleteTables: true,
    canViewMenus: true,
    canManageMenus: true,
    canViewHours: true,
    canManageHours: true,
    canViewReservations: true,
    canManageReservations: true,
    canViewUsers: true,
    canManageUsers: true,
    canViewConsoleAdmin: true,
    canManageConsoleAdmin: true
  },
  PROPRIETARIO: {
    canViewDashboard: true,
    canViewLocations: true,
    canManageLocations: true,
    canViewTables: true,
    canManageTables: true,
    canDeleteTables: true,
    canViewMenus: true,
    canManageMenus: true,
    canViewHours: true,
    canManageHours: true,
    canViewReservations: true,
    canManageReservations: true,
    canViewUsers: true,
    canManageUsers: true,
    canViewConsoleAdmin: false,
    canManageConsoleAdmin: false
  },
  STORE_MANAGER: {
    canViewDashboard: true,
    canViewLocations: false,
    canManageLocations: false,
    canViewTables: true,
    canManageTables: true,
    canDeleteTables: false,
    canViewMenus: true,
    canManageMenus: true,
    canViewHours: true,
    canManageHours: true,
    canViewReservations: true,
    canManageReservations: true,
    canViewUsers: false,
    canManageUsers: false,
    canViewConsoleAdmin: false,
    canManageConsoleAdmin: false
  },
  STAFF: {
    canViewDashboard: true,
    canViewLocations: false,
    canManageLocations: false,
    canViewTables: false,
    canManageTables: false,
    canDeleteTables: false,
    canViewMenus: false,
    canManageMenus: false,
    canViewHours: false,
    canManageHours: false,
    canViewReservations: true,
    canManageReservations: false,
    canViewUsers: false,
    canManageUsers: false,
    canViewConsoleAdmin: false,
    canManageConsoleAdmin: false
  }
};
const defaultZones = [
  { name: "Sala interna", sortOrder: 1, active: true },
  { name: "Dehors", sortOrder: 2, active: true }
];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function generatePassword() {
  return `Coperto!${randomBytes(6).toString("hex")}`;
}

async function main() {
  let generatedPassword = null;
  const email = process.env.SEED_ADMIN_EMAIL || "admin@coperto.local";
  let admin = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (!admin) {
    generatedPassword = process.env.SEED_ADMIN_PASSWORD || generatePassword();
    admin = await prisma.user.create({
      data: {
        name: "Amministratore Coperto",
        email,
        passwordHash: hashPassword(generatedPassword),
        role: "ADMIN",
        active: true
      }
    });
  }

  let location = await prisma.location.findFirst({
    where: {
      slug: "sede-centrale"
    }
  });

  if (!location) {
    location = await prisma.location.create({
      data: {
        name: "Sede Centrale",
        slug: "sede-centrale",
        city: "Milano",
        address: "Via della Ristorazione 1",
        phone: "+39 02 0000000",
        email: "booking@sede-centrale.it",
        reservationEnabled: true,
        settings: {
          create: {
            pageTitle: "Prenota da Sede Centrale",
            welcomeMessage: "Compila il form per inviare la tua richiesta.",
            durationMinutes: 120,
            leadTimeMinutes: 60,
            minGuests: 1,
            maxGuests: 8,
            requirePhone: true,
            requireEmail: true
          }
        },
        technicalSettings: {
          create: {
            displayName: "Sede Centrale",
            qrEnabled: true,
            reservationsEnabled: true,
            deliveryEnabled: false,
            paymentsEnabled: false,
            googleBusinessEnabled: false,
            reservationEmails: "booking@sede-centrale.it"
          }
        },
        openingHours: {
          create: [
            { weekday: 1, opensAt: "12:00", closesAt: "23:00", isClosed: false },
            { weekday: 2, opensAt: "12:00", closesAt: "23:00", isClosed: false },
            { weekday: 3, opensAt: "12:00", closesAt: "23:00", isClosed: false },
            { weekday: 4, opensAt: "12:00", closesAt: "23:00", isClosed: false },
            { weekday: 5, opensAt: "12:00", closesAt: "23:30", isClosed: false },
            { weekday: 6, opensAt: "12:00", closesAt: "23:30", isClosed: false },
            { weekday: 0, opensAt: "12:00", closesAt: "22:30", isClosed: false }
          ]
        },
        tables: {
          create: Array.from({ length: 10 }, (_, index) => ({
            code: `T${index + 1}`,
            seats: index < 4 ? 2 : 4,
            zone: index < 6 ? "Sala interna" : "Dehors",
            active: true
          }))
        },
        menus: {
          create: {
            name: "Menu principale",
            description: "Prima configurazione del ristorante",
            isActive: true,
            deliveryEnabled: false,
            appliesToAllLocations: false,
            locationIds: [],
            sections: {
              create: [
                {
                  name: "Antipasti",
                  sortOrder: 1,
                  items: {
                    create: [
                      {
                        name: "Crudo di ricciola",
                        description: "Agrumi, finocchietto e pepe rosa",
                        price: 18,
                        available: true,
                        sortOrder: 1
                      }
                    ]
                  }
                },
                {
                  name: "Primi",
                  sortOrder: 2,
                  items: {
                    create: [
                      {
                        name: "Risotto al limone",
                        description: "Burro affumicato e limone di Amalfi",
                        price: 22,
                        available: true,
                        sortOrder: 1
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    });
  }

  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: admin.id,
        locationId: location.id
      }
    },
    update: {},
    create: {
      userId: admin.id,
      locationId: location.id
    }
  });

  await prisma.locationTechnicalSetting.upsert({
    where: {
      locationId: location.id
    },
    update: {},
    create: {
      locationId: location.id,
      displayName: location.name,
      qrEnabled: true,
      reservationsEnabled: true,
      deliveryEnabled: false,
      paymentsEnabled: false,
      googleBusinessEnabled: false,
      reservationEmails: "booking@sede-centrale.it"
    }
  });

  for (const [role, permission] of Object.entries(defaultRolePermissions)) {
    await prisma.rolePermission.upsert({
      where: {
        role
      },
      update: permission,
      create: {
        role,
        ...permission
      }
    });
  }

  for (const zone of defaultZones) {
    await prisma.locationZone.upsert({
      where: {
        locationId_name: {
          locationId: location.id,
          name: zone.name
        }
      },
      update: {
        sortOrder: zone.sortOrder,
        active: zone.active
      },
      create: {
        locationId: location.id,
        ...zone
      }
    });
  }

  const zones = await prisma.locationZone.findMany({
    where: {
      locationId: location.id
    }
  });

  for (const zone of zones) {
    await prisma.diningTable.updateMany({
      where: {
        locationId: location.id,
        zone: zone.name,
        zoneId: null
      },
      data: {
        zoneId: zone.id
      }
    });
  }

  console.log(`Admin email: ${email}`);

  if (generatedPassword) {
    console.log(`Admin password: ${generatedPassword}`);
  } else {
    console.log("Admin password: gia' esistente, non modificata.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
