import { RoleDocument, RoleModel } from "../modules/role/model";
import { Role, Permission } from "../types/User";

let cachedRoles: Record<string, { id: string; permissions: Permission[] }> | null = null;

/**
 * Fetches role IDs and permissions, caching them to avoid redundant database queries within a single runtime.
 */
export const getRoles = async (): Promise<Record<string, { id: string; permissions: Permission[] }>> => {
  if (!cachedRoles) {
    const roles: RoleDocument[] = await RoleModel.find({});
    cachedRoles = roles.reduce((acc, role) => {
      acc[role.name] = { id: role._id.toString(), permissions: role.permissions || [] };
      return acc;
    }, {} as Record<string, { id: string; permissions: Permission[] }>);
  }  
  return cachedRoles;
};

// /**
//  * Checks if a user has a specified role or permission.
//  * @param userRoles The array of user role IDs.
//  * @param options An object containing either `roles` (array of role names) or `permission` (resource & action).
//  * @returns A promise that resolves to true if the user has access, otherwise false.
//  */
// export const hasAccess = async (
//   userRoles: string[],
//   options: { roles?: string[]; permission?: { resource: string; action: string } }
// ): Promise<boolean> => {
//   if (!userRoles || userRoles.length === 0) return false;

//   const roles = await getRoles(); // Fetch roles and permissions (cached after first call)

//   // Check for role match
//   if (options.roles) {
//     if (options.roles.some(roleName => userRoles.includes(roles[roleName]?.id))) {
//       return true;
//     }
//   }

//   // Check for permission match
//   if (options.permission) {
//     const { resource, action } = options.permission;
//     return userRoles.some(roleId =>
//       Object.values(roles).some(role =>
//         role.id === roleId &&
//         role.permissions.some(permission =>
//           permission.resource === resource && permission.actions.includes(action)
//         )
//       )
//     );
//   }

//   return false;
// };

// Function to clear the cache (e.g., after role or permission updates)
export const clearRoleCache = () => {
  cachedRoles = null;
};



export const hasAccess =  (
  userRoles: Role[], // Expect populated user roles
  options: { roles?: string[]; permission?: { resource: string; action: string } }
): boolean => {
  if (!userRoles || userRoles.length === 0) return false;

  // Check for role match
  if (options.roles) {
    if (options.roles.some(roleName => userRoles.some(role => role.name === roleName))) {
      return true;
    }
  }

  // Check for permission match
  if (options.permission) {
    const { resource, action } = options.permission;
    return userRoles.some(role =>
      role.permissions.some(permission =>
        permission.resource === resource && permission.actions.includes(action)
      )
    );
  }

  return false;
};

