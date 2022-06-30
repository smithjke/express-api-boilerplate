import { randomString } from '~/1st-core';
import { AuthInitResult, Role, Session } from '~/api';
import { Permission } from '../common';
import { usePermissionService, useSessionService, useUserService } from '../di';
import { PermissionService } from './permission-service';
import { SessionService } from './session-service';
import { UserService } from './user-service';

export class AuthService {
  private readonly permissionService: PermissionService;

  private readonly sessionService: SessionService;

  private readonly userService: UserService;

  constructor() {
    this.permissionService = usePermissionService();
    this.sessionService = useSessionService();
    this.userService = useUserService();
  }

  async getSession(token: string, permission?: Permission): Promise<Session> {
    const session = await this.sessionService.getByToken(token);

    if (!session) {
      throw new Error('No session');
    }

    session.user = await this.userService.getWithRoles(session.userId);

    if (!session.user) {
      throw new Error('No user');
    }

    if (!this.userService.isActive(session.user)) {
      throw new Error('User is not active');
    }

    if (permission) {
      const permissionCheckResult = await this.permissionService.check(session.user, permission);

      if (!permissionCheckResult) {
        throw new Error('Access denied');
      }
    }

    return session;
  }

  async login(name: string, password: string): Promise<string> {
    const user = await this.userService.getByName(name);

    // @todo check password hash
    if (!user || user.password !== password) {
      throw new Error('Incorrect data');
    }

    const session = await this.sessionService.create({
      token: randomString(32),
      // @todo real ip
      ip: '0.0.0.0',
      userId: user.id,
    });

    return session.token;
  }

  async getInit(token: string): Promise<AuthInitResult> {
    const session = await this.sessionService.getByToken(token);
    const user = await this.userService.getWithRoles(session.userId);
    const permissions = Object.keys(this.getPermissions(user.roles));
    return {
      session,
      user,
      permissions,
    };
  }

  getPermissions(roles: Array<Role>): Record<string, true> {
    const data = {};
    roles.forEach((role) => role.permissions.split('|').map((permission) => data[permission] = true));
    return data;
  }
}
