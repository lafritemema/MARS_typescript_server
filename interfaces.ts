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
  amqp?:AMQPConfiguration,
  http?:HTTPConfiguration
}


export interface AMQPConfiguration {
  activate:boolean,
  type:string,
  host:string,
  port:number,
  exchange:AMQPExchange
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
  topic?:string,
  [key:string]:any
}

export interface ConsumerPacket {
  body: MessageBody,
  headers: MessageHeaders,
  query: MessageQuery
}

export interface RequestDefinition {
  path:string,
  method:string,
  query?:object,
  body?:object,
}

export interface AMQPHeader extends MessagePropertyHeaders, MessageHeaders {
  // eslint-disable-next-line camelcase
  report_topic?:string,
  path?:string,
  publisher:string,
}
