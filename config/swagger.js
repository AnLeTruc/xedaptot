const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Xedaptot API',
            version: '1.0.0',
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production'
                    ? 'https://xedaptot.onrender.com/api'
                    : `http://localhost:${process.env.PORT || 5000}/api`,

                //Description
                description: process.env.NODE_ENV === 'production'
                    ? 'Production Server'
                    : 'Production Server',
            },
        ],

        //Component
        components: {
            //Security Schemes
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT Authorization header using the Bearer scheme',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Error message' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            description: 'MongoDB ObjectId',
                            example: '64d1b5b5b5b5b5b5b5b5b5b5'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'Email of user',
                            example: 'user@gmail.com'
                        },
                        fullName: {
                            type: 'string',
                            description: 'Fullname of user',
                            example: 'Nguyen Van A'
                        },
                        phone: {
                            type: 'string',
                            description: 'Phone number',
                            example: '0123456789'
                        },
                        avatarUrl: {
                            type: 'string',
                            description: 'URL of avatar',
                            example: 'https://example.com/avatar.jpg'
                        },
                        address: {
                            type: 'object',
                            description: 'Address',
                            properties: {
                                street: {
                                    type: 'string',
                                    example: '123 Nguyen Hue'
                                },
                                ward: {
                                    type: 'string',
                                    example: 'Ben Nghe'
                                },
                                district: {
                                    type: 'string',
                                    example: '1'
                                },
                                city: {
                                    type: 'string',
                                    example: 'Ho Chi Minh'
                                },
                            },
                        },
                        roles: {
                            type: 'array',
                            description: 'Roles of user',
                            items: {
                                type: 'string',
                                enum: ['BUYER', 'SELLER', 'ADMIN', 'INSPECTOR']
                            },
                            example: ['BUYER', 'SELLER']
                        },
                        reputationScore: {
                            type: 'number',
                            description: 'Reputation score',
                            minimum: 0,
                            maximum: 5,
                            example: 3.5
                        },
                        isVerified: {
                            type: 'boolean',
                            description: 'Is user verified',
                            example: true
                        },
                        isActive: {
                            type: 'boolean',
                            description: 'User is active',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Date created',
                            example: '2026-01-01T00:00:00.000Z'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            description: 'Date updated',
                            example: '2026-01-01T00:00:00.000Z'
                        }
                    }
                }
            }
        },

        security: [
            {
                bearerAuth: []
            }
        ],

        tags: [
            {
                name: 'Auth',
                description: 'Authentication endpoints'
            },
            {
                name: 'Users',
                description: 'User profile management'
            }
        ],
    },
    apis: [
        './routes/*.js',
        './models/*.js',
    ],
};

//Swagger spec
const specs = require('../docs/openapi.json');

const swaggerUiOptions = {
    explorer: true,

    customCss: `
    .swagger-ui .topbar {display: none}
    .swagger-ui .info {margin-bottom: 20px}
    .swagger-ui .info .title {color: }`
    ,

    customSiteTitle: 'Xedaptot API Docs',

    swaggerOptions: {
        persisAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true
    }
};

const setupSwagger = (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));

    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(specs);
    });

    console.log(`Swagger Docs: http://localhost:${process.env.PORT || 5000}/api-docs`);
}

module.exports = {
    setupSwagger,
    specs
};

