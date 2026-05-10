import xmlrpc from 'xmlrpc'

export interface OdooConfig {
  url: string
  database: string
  username: string
  password: string
}

type XmlRpcValue = string | number | boolean | Record<string, unknown> | unknown[]

function makeClient(baseUrl: string, path: string) {
  const parsed = new URL(baseUrl)
  const port = parsed.port
    ? Number(parsed.port)
    : parsed.protocol === 'https:' ? 443 : 80
  const opts = { host: parsed.hostname, port, path }
  return parsed.protocol === 'https:'
    ? xmlrpc.createSecureClient(opts)
    : xmlrpc.createClient(opts)
}

function call(client: ReturnType<typeof xmlrpc.createClient>, method: string, params: XmlRpcValue[]): Promise<XmlRpcValue> {
  return new Promise((resolve, reject) =>
    client.methodCall(method, params, (err, val) => (err ? reject(err) : resolve(val)))
  )
}

export async function odooLogin(config: OdooConfig): Promise<number> {
  const client = makeClient(config.url, '/xmlrpc/2/common')
  const uid = await call(client, 'authenticate', [
    config.database,
    config.username,
    config.password,
    {},
  ])
  if (!uid || typeof uid !== 'number') throw new Error('Invalid Odoo credentials or database name')
  return uid
}

async function executeKw(
  config: OdooConfig,
  uid: number,
  model: string,
  method: string,
  args: XmlRpcValue[],
  kwargs: Record<string, unknown> = {}
): Promise<XmlRpcValue> {
  const client = makeClient(config.url, '/xmlrpc/2/object')
  return call(client, 'execute_kw', [
    config.database,
    uid,
    config.password,
    model,
    method,
    args,
    kwargs,
  ])
}

export async function getProjects(config: OdooConfig) {
  const uid = await odooLogin(config)
  return executeKw(config, uid, 'project.project', 'search_read', [[['active', '=', true]]], {
    fields: ['id', 'name'],
    order: 'name asc',
    limit: 200,
  })
}

export async function getTasks(config: OdooConfig, projectId: number) {
  const uid = await odooLogin(config)
  return executeKw(
    config,
    uid,
    'project.task',
    'search_read',
    [[
      ['project_id', '=', projectId],
      ['active', '=', true],
    ]],
    { fields: ['id', 'name'], order: 'name asc', limit: 200 }
  )
}

export async function createTimesheetEntry(
  config: OdooConfig,
  entry: {
    projectId: number
    taskId: number
    date: string
    hours: number
    description: string
  }
): Promise<number> {
  const uid = await odooLogin(config)
  const id = await executeKw(config, uid, 'account.analytic.line', 'create', [
    {
      project_id: entry.projectId,
      task_id: entry.taskId,
      date: entry.date,
      unit_amount: entry.hours,
      name: entry.description,
    },
  ])
  return id as number
}
