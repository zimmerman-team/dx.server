import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  Request,
  requestBody,
  response,
  RestBindings,
} from '@loopback/rest';
import axios from 'axios';
import _ from 'lodash';
import {Report} from '../models';
import {ReportRepository} from '../repositories';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

async function getReportsCount(
  reportRepository: ReportRepository,
  owner?: string,
  where?: Where<Report>,
) {
  return reportRepository.count({
    ...where,
    or: [{owner: owner}, {public: true}],
  });
}

async function getReports(
  reportRepository: ReportRepository,
  owner?: string,
  filter?: Filter<Report>,
) {
  return reportRepository.find({
    ...filter,
    where: {
      ...filter?.where,
      or: [{owner: owner}, {public: true}],
    },
    fields: [
      'id',
      'name',
      'createdDate',
      'showHeader',
      'backgroundColor',
      'title',
      'subTitle',
      'public',
    ],
  });
}

async function renderReport(
  chartRepository: ReportRepository,
  id: string,
  body: any,
  owner: string,
) {
  const report = await chartRepository.findById(id);
  if (!report || (!report.public && report.owner !== owner)) {
    return;
  }
  const host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
  const result = await (
    await axios.post(`http://${host}:4400/render/report/${id}`, {...body})
  ).data;
  return result;
}

export class ReportsController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(ReportRepository)
    public ReportRepository: ReportRepository,
  ) {}
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  @post('/report')
  @logInvocation()
  @response(200, {
    description: 'Report model instance',
    content: {'application/json': {schema: getModelSchemaRef(Report)}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {
            title: 'NewReport',
            exclude: ['id'],
          }),
        },
      },
    })
    Report: Omit<Report, 'id'>,
  ): Promise<Report> {
    this.logger.info(`route </report> creating a new report`);
    Report.owner = _.get(this.req, 'user.sub', 'anonymous');
    return this.ReportRepository.create(Report);
  }

  @get('/reports/count')
  @logInvocation()
  @response(200, {
    description: 'Report model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(@param.where(Report) where?: Where<Report>): Promise<Count> {
    this.logger.info(`route </reports/count> getting reports count`);
    return getReportsCount(
      this.ReportRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      where,
    );
  }

  @get('/reports/count/public')
  @logInvocation()
  @response(200, {
    description: 'Report model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async countPublic(
    @param.where(Report) where?: Where<Report>,
  ): Promise<Count> {
    this.logger.info(
      `route </reports/count/public> getting public reports count`,
    );
    return getReportsCount(
      this.ReportRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      where,
    );
  }

  @get('/reports')
  @logInvocation()
  @response(200, {
    description: 'Array of Report model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Report, {includeRelations: true}),
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async find(@param.filter(Report) filter?: Filter<Report>): Promise<Report[]> {
    this.logger.info(`route </reports> getting reports`);
    return getReports(
      this.ReportRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      filter,
    );
  }

  @get('/reports/public')
  @logInvocation()
  @response(200, {
    description: 'Array of Report model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Report, {includeRelations: true}),
        },
      },
    },
  })
  async findPublic(
    @param.filter(Report) filter?: Filter<Report>,
  ): Promise<Report[]> {
    this.logger.info(`route </reports/public> getting public reports`);
    return getReports(
      this.ReportRepository,
      _.get(this.req, 'user.sub', 'anonymous'),
      filter,
    );
  }

  @patch('/report')
  @logInvocation()
  @response(200, {
    description: 'Report PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {partial: true}),
        },
      },
    })
    Report: Report,
    @param.where(Report) where?: Where<Report>,
  ): Promise<Count> {
    this.logger.info(`route </report> updating all reports`);
    return this.ReportRepository.updateAll(Report, where);
  }

  @get('/report/{id}')
  @logInvocation()
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Report, {exclude: 'where'})
    filter?: FilterExcludingWhere<Report>,
  ): Promise<Report | {error: string}> {
    this.logger.info(`route </report/{id}> getting report by id ${id}`);
    const report = await this.ReportRepository.findById(id, filter);
    if (
      report.public ||
      report.owner === _.get(this.req, 'user.sub', 'anonymous')
    ) {
      this.logger.info(`route </report/{id}> report found`);
      return report;
    }
    this.logger.info(`route </report/{id}> unauthorized`);
    return {error: 'Unauthorized'};
  }

  @get('/report/public/{id}')
  @logInvocation()
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  async findPublicById(
    @param.path.string('id') id: string,
    @param.filter(Report, {exclude: 'where'})
    filter?: FilterExcludingWhere<Report>,
  ): Promise<Report | {error: string}> {
    this.logger.info(
      `route </report/public/{id}> getting public report by id ${id}`,
    );
    const report = await this.ReportRepository.findById(id, filter);
    if (report.public) {
      this.logger.info(`route </report/public/{id}> report found`);
      return report;
    } else {
      this.logger.info(`route </report/public/{id}> unauthorized`);
      return {error: 'Unauthorized'};
    }
  }

  @post('/report/{id}/render')
  @logInvocation()
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async renderById(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    this.logger.info(
      `route </report/{id}/render> rendering report by id ${id}`,
    );
    return renderReport(
      this.ReportRepository,
      id,
      body,
      _.get(this.req, 'user.sub', 'anonymous'),
    );
  }

  @post('/report/{id}/render/public')
  @logInvocation()
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  async renderPublicById(
    @param.path.string('id') id: string,
    @requestBody() body: any,
  ) {
    this.logger.info(
      `route </report/{id}/render/public> rendering public report by id ${id}`,
    );
    return renderReport(
      this.ReportRepository,
      id,
      body,
      _.get(this.req, 'user.sub', 'anonymous'),
    );
  }

  @patch('/report/{id}')
  @logInvocation()
  @response(204, {
    description: 'Report PATCH success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Report, {partial: true}),
        },
      },
    })
    report: Report,
  ): Promise<void> {
    this.logger.info(`route </report/{id}> updating report by id ${id}`);
    await this.ReportRepository.updateById(id, {
      ...report,
      updatedDate: new Date().toISOString(),
    });
  }

  @put('/report/{id}')
  @logInvocation()
  @response(204, {
    description: 'Report PUT success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() Report: Report,
  ): Promise<void> {
    this.logger.info(`route </report/{id}> replacing report by id ${id}`);
    await this.ReportRepository.replaceById(id, Report);
  }

  @del('/report/{id}')
  @logInvocation()
  @response(204, {
    description: 'Report DELETE success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    this.logger.info(`route </report/{id}> deleting report by id ${id}`);
    await this.ReportRepository.deleteById(id);
  }

  @get('/report/duplicate/{id}')
  @logInvocation()
  @response(200, {
    description: 'Report model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async duplicate(@param.path.string('id') id: string): Promise<Report> {
    this.logger.info(
      `route </report/duplicate/{id}> duplicating report by id ${id}`,
    );
    const fReport = await this.ReportRepository.findById(id);
    return this.ReportRepository.create({
      name: `${fReport.name} (Copy)`,
      showHeader: fReport.showHeader,
      title: fReport.title,
      subTitle: fReport.subTitle,
      rows: fReport.rows,
      public: false,
      backgroundColor: fReport.backgroundColor,
      titleColor: fReport.titleColor,
      descriptionColor: fReport.descriptionColor,
      dateColor: fReport.dateColor,
      owner: _.get(this.req, 'user.sub', 'anonymous'),
    });
  }
}
