import { db } from "./db";
import { getAccessibleLocationIds } from "./permissions";

function buildScopeWhere(user, pageKey) {
  const accessibleLocationIds = getAccessibleLocationIds(user);

  return {
    pageKey,
    OR: [
      {
        userId: user.id
      },
      {
        userId: null,
        role: user.role,
        ...(accessibleLocationIds === null
          ? {}
          : {
              OR: [
                { locationId: null },
                {
                  locationId: {
                    in: accessibleLocationIds
                  }
                }
              ]
            })
      }
    ]
  };
}

export async function getSavedFiltersForPage(user, pageKey) {
  if (!user?.id || !pageKey) {
    return [];
  }

  return db.savedFilter.findMany({
    where: buildScopeWhere(user, pageKey),
    orderBy: [
      {
        isDefault: "desc"
      },
      {
        name: "asc"
      }
    ]
  });
}

export async function saveSavedFilter({
  user,
  pageKey,
  name,
  filters,
  locationId = null,
  isDefault = false
}) {
  if (!user?.id || !pageKey || !name) {
    return null;
  }

  if (isDefault) {
    await db.savedFilter.updateMany({
      where: {
        userId: user.id,
        pageKey
      },
      data: {
        isDefault: false
      }
    });
  }

  return db.savedFilter.create({
    data: {
      userId: user.id,
      role: user.role,
      pageKey,
      name,
      locationId,
      filters,
      isDefault
    }
  });
}

export async function deleteSavedFilter(user, filterId) {
  if (!user?.id || !filterId) {
    return 0;
  }

  const deleted = await db.savedFilter.deleteMany({
    where: {
      id: filterId,
      OR: [
        {
          userId: user.id
        },
        {
          userId: null,
          role: user.role
        }
      ]
    }
  });

  return deleted.count;
}
