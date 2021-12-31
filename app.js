const Koa = require('koa')
const app = new Koa()
const json = require('koa-json')
const bodyParser = require('koa-bodyparser')
const parameter = require('koa-parameter')
const koaJwt = require('koa-jwt') //路由权限控制
const koaStatic = require('koa-static')

const MongoConnect = require('./db')
const { token: tokenConfig } = require('./utils/config')

const { logger, accessLogger } = require('./logger')

const swagger = require('./utils/swagger') // 存放swagger.js的位置，可以自行配置
const { koaSwagger } = require('koa2-swagger-ui')

//静态文件
app.use(koaStatic(__dirname + '/public'))

// 接口文档配置
app.use(swagger.routes(), swagger.allowedMethods())
app.use(
    koaSwagger({
        routePrefix: '/swagger', // 接口文档访问地址
        swaggerOptions: {
            url: '/swagger.json', // example path to json 其实就是之后swagger-jsdoc生成的文档地址
        },
    })
)

// mongodb
MongoConnect()

//访问日志
app.use(accessLogger())

//错误处理
app.use(async (ctx, next) => {
    try {
        await next()
        // 捕获不到异常，但状态码为404
        if (ctx.status === 404) {
            ctx.body = {
                code: 404,
                msg: '页面找不到',
            }
        }
    } catch (err) {
        ctx.body = {
            code: 500,
            msg: err.message,
        }
        ctx.app.emit('error', err, ctx)
    }
})

// Custom 401 handling if you don't want to expose koa-jwt errors to users
app.use((ctx, next) => {
    return next().catch(err => {
        if (401 == err.status) {
            ctx.body = {
                code: 401,
                msg: 'Protected resource, use Authorization header to get access',
            }
        } else {
            throw err
        }
    })
})

// token拦截
app.use(
    koaJwt({ secret: tokenConfig.secret }).unless({
        path: [/^\/users\/register/, /^\/users\/login/],
    })
)

// json美化
app.use(json())

// Post请求
app.use(bodyParser())

//验证器，放在请求体后
app.use(parameter(app))

// router
const users = require('./routes/user')
const upload = require('./routes/upload')
app.use(users.routes(), users.allowedMethods())
app.use(upload.routes(), upload.allowedMethods())

// 应用日志
app.on('error', (err, ctx) => {
    logger.error(err)
})

module.exports = app
