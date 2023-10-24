import {authenticate} from '@loopback/authentication';
import {BindingKey, inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  Where,
  repository,
} from '@loopback/repository';
import {
  Request,
  RestBindings,
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
  response,
} from '@loopback/rest';
import axios from 'axios';
import {Dataset} from '../models';
import {DatasetRepository} from '../repositories';

import {RequestHandler} from 'express-serve-static-core';
import _ from 'lodash';

type FileUploadHandler = RequestHandler;

const FILE_UPLOAD_SERVICE = BindingKey.create<FileUploadHandler>(
  'services.FileUpload',
);

export class DatasetController {
  constructor(
    @inject(RestBindings.Http.REQUEST) private req: Request,
    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,
    @inject(FILE_UPLOAD_SERVICE) private handler: FileUploadHandler,
  ) {}

  @post('/datasets')
  @response(200, {
    description: 'Dataset model instance',
    // content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
    content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {
            title: 'NewDataset',
            exclude: ['id'],
          }),
        },
      },
    })
    dataset: Omit<Dataset, 'id'>,
  ): Promise<Dataset> {
    dataset.owner = _.get(this.req, 'user.sub', 'anonymous');
    return this.datasetRepository.create(dataset);
  }

  @get('/datasets/count')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async count(@param.where(Dataset) where?: Where<Dataset>): Promise<Count> {
    return this.datasetRepository.count({
      ...where,
      or: [{owner: _.get(this.req, 'user.sub', 'anonymous')}],
    });
  }

  @get('/datasets')
  @response(200, {
    description: 'Array of Dataset model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Dataset, {includeRelations: true}),
        },
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async find(
    @param.filter(Dataset) filter?: Filter<Dataset>,
  ): Promise<Dataset[]> {
    return this.datasetRepository.find({
      ...filter,
      where: {
        ...filter?.where,
        or: [{owner: _.get(this.req, 'user.sub', 'anonymous')}],
      },
    });
  }

  @patch('/datasets')
  @response(200, {
    description: 'Dataset PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.datasetRepository.updateAll(dataset, where);
  }

  @get('/datasets/{id}')
  @response(200, {
    description: 'Dataset model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Dataset, {includeRelations: true}),
      },
    },
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Dataset, {exclude: 'where'})
    filter?: FilterExcludingWhere<Dataset>,
  ): Promise<Dataset> {
    return this.datasetRepository.findById(id, filter);
  }

  @patch('/datasets/{id}')
  @response(204, {
    description: 'Dataset PATCH success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
  ): Promise<void> {
    await this.datasetRepository.updateById(id, {
      ...dataset,
      updatedDate: new Date().toISOString(),
    });
  }

  @put('/datasets/{id}')
  @response(204, {
    description: 'Dataset PUT success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() dataset: Dataset,
  ): Promise<void> {
    await this.datasetRepository.replaceById(id, dataset);
  }

  @del('/datasets/{id}')
  @response(204, {
    description: 'Dataset DELETE success',
  })
  @authenticate({strategy: 'auth0-jwt', options: {scopes: ['greet']}})
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    this.datasetRepository.findById(id).then(() => {
      // Trigger the dataset removal through the backend, cleaning up SSR and the backend
      let host = process.env.BACKEND_SUBDOMAIN ? 'dx-backend' : 'localhost';
      if (process.env.ENV_TYPE !== 'prod')
        host = process.env.ENV_TYPE
          ? `dx-backend-${process.env.ENV_TYPE}`
          : host;
      axios
        .post(`${host}:4004/delete-dataset/dx${id}`)
        .then(_ => console.log('File removed from DX Backend'))
        .catch(_ => {
          console.log('Failed to remove the dataset from DX Backend');
        });
    });
    await this.datasetRepository.deleteById(id);
  }
}
