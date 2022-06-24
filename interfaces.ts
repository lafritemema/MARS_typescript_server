import {MessagePropertyHeaders} from 'amqplib/properties';
import {Configuration} from 'src/common/interfaces';
import {ExceptionDescription} from '../common';

export interface ServerExceptionDescription extends ExceptionDescription {
  code:number
}

export interface AMQPHeader extends MessagePropertyHeaders {
  // eslint-disable-next-line camelcase
  report_topic?:string,
  publisher:string,
  path?:string
}

export interface AMQPExchange {
  name:string,
  type:string,
}

export interface ServerConfiguration extends Configuration {
  amqp:AMQPConfiguration|undefined,
  http:object|undefined
}


export interface AMQPConfiguration {
  activate:boolean,
  type:string,
  host:string,
  port:number,
  exchange:ExchangeConfiguration
}

export interface ExchangeConfiguration {
  name:string,
  type:string
}

export interface HTTPConfiguration {
  host:string,
  port:number,
  activate:boolean
}

export interface AMQPMessage {
  publisher:string,
  body:object,
  consumer:string,
  header:MessagePropertyHeaders,
  topic:string
}
