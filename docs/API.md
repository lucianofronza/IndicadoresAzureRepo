# API Documentation - Indicadores Azure Repos

## Base URL
- **Development**: `http://localhost:8080/api`
- **Production**: `https://api.indicadores.example.com`

## Authentication

### Azure DevOps OAuth Flow

1. **Get Authorization URL**
   ```
   GET /auth/azure/authorize
   ```
   Returns the Azure DevOps OAuth authorization URL.

2. **OAuth Callback**
   ```
   GET /auth/azure/callback?code={code}&state={state}
   ```
   Handles the OAuth callback and exchanges code for token.

3. **Refresh Token**
   ```
   POST /auth/azure/refresh
   {
     "refreshToken": "string",
     "userId": "string"
   }
   ```

4. **Revoke Token**
   ```
   POST /auth/azure/revoke
   {
     "accessToken": "string",
     "userId": "string"
   }
   ```

## Health Checks

### Health Check
```
GET /healthz
```

### Readiness Check
```
GET /readyz
```

### Metrics (Prometheus)
```
GET /metrics
```

## Teams

### Get All Teams
```
GET /teams?page=1&pageSize=10&sortBy=name&sortOrder=asc
```

### Get Team by ID
```
GET /teams/{id}
```

### Create Team
```
POST /teams
{
  "name": "string",
  "management": "string"
}
```

### Update Team
```
PUT /teams/{id}
{
  "name": "string",
  "management": "string"
}
```

### Delete Team
```
DELETE /teams/{id}
```

### Get Team Statistics
```
GET /teams/{id}/stats
```

### Get Team Developers
```
GET /teams/{id}/developers?page=1&pageSize=10
```

### Get Team Repositories
```
GET /teams/{id}/repositories?page=1&pageSize=10
```

## Roles

### Get All Roles
```
GET /roles?page=1&pageSize=10&sortBy=name&sortOrder=asc
```

### Get Role by ID
```
GET /roles/{id}
```

### Create Role
```
POST /roles
{
  "name": "string"
}
```

### Update Role
```
PUT /roles/{id}
{
  "name": "string"
}
```

### Delete Role
```
DELETE /roles/{id}
```

## Stacks

### Get All Stacks
```
GET /stacks?page=1&pageSize=10&sortBy=name&sortOrder=asc
```

### Get Stack by ID
```
GET /stacks/{id}
```

### Create Stack
```
POST /stacks
{
  "name": "string"
}
```

### Update Stack
```
PUT /stacks/{id}
{
  "name": "string"
}
```

### Delete Stack
```
DELETE /stacks/{id}
```

## Developers

### Get All Developers
```
GET /developers?page=1&pageSize=10&sortBy=name&sortOrder=asc
```

### Get Developer by ID
```
GET /developers/{id}
```

### Create Developer
```
POST /developers
{
  "name": "string",
  "login": "string",
  "teamId": "string",
  "roleId": "string",
  "stackId": "string",
  "leadId": "string",
  "managerId": "string"
}
```

### Update Developer
```
PUT /developers/{id}
{
  "name": "string",
  "login": "string",
  "teamId": "string",
  "roleId": "string",
  "stackId": "string",
  "leadId": "string",
  "managerId": "string"
}
```

### Delete Developer
```
DELETE /developers/{id}
```

### Get Developer Statistics
```
GET /developers/{id}/stats
```

## Repositories

### Get All Repositories
```
GET /repositories?page=1&pageSize=10&sortBy=name&sortOrder=asc
```

### Get Repository by ID
```
GET /repositories/{id}
```

### Create Repository
```
POST /repositories
{
  "name": "string",
  "organization": "string",
  "project": "string",
  "url": "string",
  "clientId": "string",
  "clientSecret": "string",
  "teamId": "string"
}
```

### Update Repository
```
PUT /repositories/{id}
{
  "name": "string",
  "organization": "string",
  "project": "string",
  "url": "string",
  "clientId": "string",
  "clientSecret": "string",
  "teamId": "string"
}
```

### Delete Repository
```
DELETE /repositories/{id}
```

### Get Repository Statistics
```
GET /repositories/{id}/stats
```

## Sync

### Start Sync
```
POST /sync/{repositoryId}
```

### Get Sync Status
```
GET /sync/{repositoryId}/status
```

### Get Sync History
```
GET /sync/{repositoryId}/history?page=1&pageSize=10
```

### Cancel Sync
```
DELETE /sync/{repositoryId}
```

### Get All Sync Jobs
```
GET /sync?page=1&pageSize=10&status=running
```

## KPIs

### PR x Review x Comments Chart
```
GET /kpis/pr-review-comments?startDate=2024-01-01&endDate=2024-12-31&teamId=123
```

### PR x Commit Chart
```
GET /kpis/pr-commit?startDate=2024-01-01&endDate=2024-12-31&teamId=123
```

### PR x Review Chart
```
GET /kpis/pr-review?startDate=2024-01-01&endDate=2024-12-31&teamId=123
```

### Reviews Performed Chart
```
GET /kpis/reviews-performed?startDate=2024-01-01&endDate=2024-12-31&teamId=123
```

### Roles by Team Chart
```
GET /kpis/roles-by-team?teamId=123
```

### Files Changed by PR Chart
```
GET /kpis/files-changed?startDate=2024-01-01&endDate=2024-12-31&repositoryId=123
```

### Lines Changed by PR Chart
```
GET /kpis/lines-changed?startDate=2024-01-01&endDate=2024-12-31&repositoryId=123
```

### Cycle Time PR Chart
```
GET /kpis/cycle-time?startDate=2024-01-01&endDate=2024-12-31&teamId=123
```

### Time to First Review Chart
```
GET /kpis/time-to-first-review?startDate=2024-01-01&endDate=2024-12-31&teamId=123
```

### Top 10 Cycle Time PR List
```
GET /kpis/top-cycle-time?startDate=2024-01-01&endDate=2024-12-31&page=1&pageSize=10
```

### Top 10 Time to Review List
```
GET /kpis/top-time-to-review?startDate=2024-01-01&endDate=2024-12-31&page=1&pageSize=10
```

### Dashboard Summary
```
GET /kpis/dashboard-summary?startDate=2024-01-01&endDate=2024-12-31&teamId=123
```

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {},
  "message": "string",
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Error Response Format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Error description",
  "details": {},
  "requestId": "req_1234567890_abc123"
}
```

## Rate Limiting

- **Auth endpoints**: 5 requests per 15 minutes
- **Sync endpoints**: 10 requests per minute
- **General API**: 1000 requests per 15 minutes

## Pagination

All list endpoints support pagination with these query parameters:
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 10, max: 100)
- `sortBy`: Field to sort by (default: varies by endpoint)
- `sortOrder`: Sort order - 'asc' or 'desc' (default: 'asc')

## Filtering

KPI endpoints support various filters:
- `startDate`: Start date (ISO 8601 format)
- `endDate`: End date (ISO 8601 format)
- `teamId`: Filter by team ID
- `leadId`: Filter by lead ID
- `management`: Filter by management
- `status`: Filter by PR status
- `stackId`: Filter by stack ID
- `roleId`: Filter by role ID
- `developerId`: Filter by developer ID
- `repositoryId`: Filter by repository ID
