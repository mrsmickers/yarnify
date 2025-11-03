# Role-Based Access Control (RBAC) Setup Guide

This guide explains how to configure Entra ID and Yarnify to restrict access so that:
- **Only assigned users can log in** (unauthorized users are blocked)
- **simon@ingeniotech.co.uk is the sole Administrator** with full access
- **Other users must be explicitly assigned** the "User" role to access the system

## Part 1: Configure App Roles in Entra ID

### 1.1 Create App Roles

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations** → **Yarnify**
3. Select **App roles** from the left menu
4. Click **+ Create app role**

#### Administrator Role

| Field | Value |
|-------|-------|
| **Display name** | `Administrator` |
| **Allowed member types** | `Users/Groups` |
| **Value** | `admin` |
| **Description** | `Full administrative access to Yarnify with user management capabilities` |
| **Enable this app role** | ✓ Checked |

Click **Apply**

#### User Role

| Field | Value |
|-------|-------|
| **Display name** | `User` |
| **Allowed member types** | `Users/Groups` |
| **Value** | `user` |
| **Description** | `Standard user access to Yarnify` |
| **Enable this app role** | ✓ Checked |

Click **Apply**

### 1.2 Require User Assignment

This is **critical** - it blocks unauthorized users from logging in.

1. Still in Azure Portal, go to **Microsoft Entra ID**
2. Select **Enterprise applications** from the left menu
3. Find and click **Yarnify** in the list
4. Select **Properties** from the left menu
5. Find **Assignment required?** and set it to **Yes**
6. Click **Save** at the top

> 🔒 **What this does**: Only users explicitly assigned to the app can authenticate. Everyone else gets an error message at login.

## Part 2: Assign Roles to Users

### 2.1 Assign Administrator Role to Simon

1. In **Enterprise applications** → **Yarnify**
2. Select **Users and groups** from the left menu
3. Click **+ Add user/group**
4. Under **Users**, click **None Selected**
5. Search for `simon@ingeniotech.co.uk`
6. Select the user and click **Select**
7. Under **Select a role**, click **None Selected**
8. Choose **Administrator**
9. Click **Select** then **Assign**

You should now see:

```
simon@ingeniotech.co.uk | Administrator
```

### 2.2 Add Additional Users (Future)

When you want to grant access to another team member:

1. Go to **Enterprise applications** → **Yarnify** → **Users and groups**
2. Click **+ Add user/group**
3. Select the user (e.g., `jane@ingeniotech.co.uk`)
4. Choose the **User** role
5. Click **Assign**

## Part 3: Application Code Changes

### 3.1 Role-Based Guards

Create guards to protect admin-only endpoints.

**File**: `apps/api/src/modules/auth/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No roles required
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user?.roles || !Array.isArray(user.roles)) {
      return false;
    }

    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
```

**File**: `apps/api/src/modules/auth/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

### 3.2 Update Auth Module

Add the guards to your auth module:

```typescript
// apps/api/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Config comes from JwtStrategy
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
```

### 3.3 Usage Example: Protect Admin Endpoints

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AdminController {
  
  @Get('users')
  @Roles('admin') // Only administrators can access
  async listUsers() {
    return { message: 'Admin-only user list' };
  }
  
  @Get('settings')
  @Roles('admin') // Only administrators can access
  async getSettings() {
    return { message: 'Admin-only settings' };
  }
}
```

## Part 4: Database Schema for User Management

### 4.1 Prisma Schema

Add to `apps/api/prisma/schema.prisma`:

```prisma
model EntraUser {
  id            String   @id @default(cuid())
  oid           String   @unique // Object ID from Entra
  email         String   @unique
  displayName   String?
  role          String   @default("user") // 'admin' or 'user'
  enabled       Boolean  @default(true)
  lastLoginAt   DateTime?
  lastSyncedAt  DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([email])
  @@index([oid])
  @@map("entra_users")
}
```

### 4.2 Create Migration

```bash
cd apps/api
pnpm exec prisma migrate dev --name add_entra_users
```

### 4.3 Sync User on Login

Update `auth.service.ts` to sync user data:

```typescript
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService, // Add this
  ) {
    // ... existing constructor code
  }

  async getProfileAndToken(code: string) {
    // ... existing code ...

    this.assertTenant(result.idTokenClaims as EntraTokenClaims);
    const session = this.buildSessionPayload(
      result.idTokenClaims as EntraTokenClaims,
    );
    
    // Sync user to database
    await this.syncUserToDatabase(session);
    
    const accessToken = this.signSession(session);
    // ... rest of existing code
  }

  private async syncUserToDatabase(session: SessionTokenPayload) {
    try {
      await this.prisma.entraUser.upsert({
        where: { oid: session.oid },
        update: {
          email: session.email || '',
          displayName: session.name,
          lastLoginAt: new Date(),
          lastSyncedAt: new Date(),
        },
        create: {
          oid: session.oid,
          email: session.email || '',
          displayName: session.name,
          role: session.roles?.includes('admin') ? 'admin' : 'user',
          enabled: true,
          lastLoginAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to sync user to database', error);
      // Don't throw - login should still work even if DB sync fails
    }
  }
}
```

## Part 5: Frontend Role-Based Routing

### 5.1 Create Auth Context

**File**: `apps/frontend/src/contexts/AuthContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  userId: string;
  email: string | null;
  name: string | null;
  tenantId: string | null;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/api/v1/auth/profile', {
        withCredentials: true,
      });
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const logout = async () => {
    try {
      await axios.post('/api/v1/auth/logout', {}, { withCredentials: true });
      setUser(null);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const isAdmin = user?.roles?.includes('admin') ?? false;

  return (
    <AuthContext.Provider 
      value={{ user, loading, isAdmin, logout, refreshUser: fetchProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 5.2 Protected Route Component

**File**: `apps/frontend/src/components/ProtectedRoute.tsx`

```typescript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
```

### 5.3 Example Route Configuration

```typescript
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { AdminUsers } from './pages/AdminUsers';
import { Unauthorized } from './pages/Unauthorized';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/admin/users" 
        element={
          <ProtectedRoute requireAdmin>
            <AdminUsers />
          </ProtectedRoute>
        } 
      />
      
      <Route path="/unauthorized" element={<Unauthorized />} />
    </Routes>
  );
}
```

## Part 6: Testing the RBAC System

### 6.1 Test as Administrator (simon@ingeniotech.co.uk)

1. Navigate to: `http://localhost:3000/api/v1/auth/login`
2. Sign in with `simon@ingeniotech.co.uk`
3. After redirect, check: `http://localhost:3000/api/v1/auth/profile`

Expected response:
```json
{
  "userId": "...",
  "email": "simon@ingeniotech.co.uk",
  "name": "Simon Smyth",
  "tenantId": "...",
  "roles": ["admin"]
}
```

4. Access admin endpoint: `http://localhost:3000/api/v1/admin/users`
5. Should succeed ✅

### 6.2 Test with Unauthorized User

1. Try logging in with a different `@ingeniotech.co.uk` account that hasn't been assigned
2. You should see an Entra error page:

```
AADSTS50105: Your administrator has configured the application 'Yarnify' 
to block users unless they are specifically granted access.
```

3. This confirms the "Assignment required" setting is working 🔒

### 6.3 Test as Regular User

1. In Azure Portal, assign someone the "User" role
2. Have them log in
3. Check their profile - should show `"roles": ["user"]`
4. Try accessing `/api/v1/admin/users` - should get 403 Forbidden ✅

## Part 7: Admin User Management API

Create endpoints for managing users (admin only).

**File**: `apps/api/src/modules/admin/admin.controller.ts`

```typescript
import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/enable')
  async enableUser(@Param('id') id: string) {
    return this.adminService.updateUserStatus(id, true);
  }

  @Patch('users/:id/disable')
  async disableUser(@Param('id') id: string) {
    return this.adminService.updateUserStatus(id, false);
  }
}
```

**File**: `apps/api/src/modules/admin/admin.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    return this.prisma.entraUser.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        enabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserStatus(id: string, enabled: boolean) {
    return this.prisma.entraUser.update({
      where: { id },
      data: { enabled },
    });
  }
}
```

## Summary Checklist

- [ ] **App roles created in Entra** (Administrator, User)
- [ ] **Assignment required enabled** (blocks unauthorized users)
- [ ] **simon@ingeniotech.co.uk assigned Administrator role**
- [ ] **RolesGuard and Roles decorator implemented**
- [ ] **EntraUser table added to Prisma schema**
- [ ] **User sync on login implemented**
- [ ] **Admin API endpoints created**
- [ ] **Frontend AuthContext and ProtectedRoute created**
- [ ] **Tested unauthorized access (blocked)**
- [ ] **Tested admin access (allowed)**
- [ ] **Tested regular user access (limited)**

## Security Considerations

1. **Assignment Required**: Always keep this enabled in production
2. **Role Source of Truth**: Entra ID roles are authoritative, DB is a cache
3. **Token Validation**: JWT strategy should validate roles on every request
4. **Frontend Guards**: Never rely solely on frontend - always enforce on backend
5. **Audit Logging**: Consider logging admin actions for compliance

---

**Related Docs**: 
- `docs/entra-setup-guide.md` - Initial Entra configuration
- `docs/env-reference.md` - Environment variables

