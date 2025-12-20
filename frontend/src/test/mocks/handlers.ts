import { http, HttpResponse } from 'msw';

// Mock user data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_active: true,
  organization: {
    id: 'test-org-id',
    name: 'Test Organization',
  },
  roles: [
    {
      id: 'role-1',
      name: 'Requester',
      permissions: [
        'requisition.view',
        'requisition.create',
        'requisition.edit',
        'requisition.submit',
        'supplier.view',
      ],
    },
  ],
};

export const mockAdminUser = {
  ...mockUser,
  id: 'admin-user-id',
  email: 'admin@example.com',
  first_name: 'Admin',
  roles: [
    {
      id: 'role-admin',
      name: 'Organization Admin',
      permissions: ['admin.full_access'],
    },
  ],
};

export const handlers = [
  // Auth handlers
  http.get('/api/v1/users/me/', () => {
    return HttpResponse.json(mockUser);
  }),

  http.post('/api/v1/users/login/', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    if (body.email === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json(mockUser);
    }
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post('/api/v1/users/logout/', () => {
    return HttpResponse.json({ message: 'Logged out successfully' });
  }),

  // Notifications
  http.get('/api/v1/notifications/', () => {
    return HttpResponse.json({
      results: [],
      count: 0,
    });
  }),

  http.get('/api/v1/notifications/summary/', () => {
    return HttpResponse.json({
      unread_count: 0,
      urgent_count: 0,
    });
  }),

  // Comments
  http.get('/api/v1/comments/', () => {
    return HttpResponse.json({
      results: [],
      count: 0,
    });
  }),

  // Attachments
  http.get('/api/v1/attachments/', () => {
    return HttpResponse.json({
      results: [],
      count: 0,
    });
  }),
];
