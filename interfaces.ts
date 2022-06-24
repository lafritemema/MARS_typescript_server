import {MessagePropertyHeaders} from 'amqplib/properties';
import {Configuration, ExceptionDescription} from '@common/interfaces';

export interface ServerExceptionDescription extends ExceptionDescription {
  code:number
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
  body:MessageBody,
  consumer:string,
  topic:string
  headers:AMQPHeader,
}


export interface MessageBody {
  [key:string]:any
}

export interface MessageHeaders {
  [key:string]:any
}

export interface MessageQuery {
  type:'amqp'|'http',
  path?:string,
  [key:string]:any
}

export interface ConsumerPacket {
  body: MessageBody,
  headers: MessageHeaders,
  query: MessageQuery
}

export interface AMQPHeader extends MessagePropertyHeaders, MessageHeaders {
  // eslint-disable-next-line camelcase
  report_topic?:string,
  path?:string,
  publisher:string,
}

export interface AMQPQuery extends MessageQuery {
  topic?:string
}
