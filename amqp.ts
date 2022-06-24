import * as amqp from 'amqplib';
import {ServerException, ServerExceptionType} from './exceptions';
import {AMQPExchange,
    AMQPHeader,
    AMQPMessage,
    AMQPQuery,
    ConsumerPacket} from './interfaces';
import Logger from '@common/logger';
import {EventEmitter} from 'stream';
import { cp } from 'fs';

// type ConsumerFctType = (body:object, header:object)=>[object, object]

/**
 * function used by pipeline to browse throw consuming functions
 * @param {[object,object]} msgElement : tuple body, header
 * @param {Function} consumer : consumer function
 * @return {[object, object]} : tuple body, header after processing
 */
function browseConsumer(msgElement:ConsumerPacket,
    consumer:(cPacket:ConsumerPacket)=>ConsumerPacket) {
  return consumer(msgElement);
}

/**
 * pipeline of consumer
 * @param {ConsumerFctType[]} consumers : consuming functions
 * @return {Function} : the pipeline function
 */
export function pipeline(...consumers: Array<(cPacket:ConsumerPacket)=>ConsumerPacket>):Function {
  return (cPacket:ConsumerPacket) => {
    return consumers.reduce(browseConsumer, cPacket);
  };
}

const postman = new EventEmitter();

/**
 * class describing a topic
 */
class Topic {
  private _consumers:Function[];

  /**
   * topic constructor
   * @param {Function[]} consumers : list of consuming functions
   * linked to the topic
   */
  public constructor(consumers:Function[]|undefined) {
    this._consumers = consumers ? consumers : [];
  }

  /**
   * consumer getter
   */
  public get consumers() {
    return this._consumers;
  }

  /**
   * function to add consumers function to topics
   * @param {Function} consumer : new consuming function
   */
  public addConsumer(consumer:Function) {
    this._consumers.push(consumer);
  }
}

/**
 * class describing an AMQP Queue
 */
class AMQPQueue {
  private _topics:{[rkey:string]:Topic};
  private _label:string;
  private _amqpId!:string;

  /**
   * amqp queue constructor
   * @param {string} label : queue label
   */
  public constructor(label:string) {
    this._label = label;
    this._topics = {};
  }

  /**
   * label getter
   */
  public get label() {
    return this._label;
  }

  /**
   * queue amqp id getter
   */
  public get amqpId() {
    return this._amqpId;
  }

  /**
   * queue amqp id setter
   * @param {string} amqpId : amqp id value
   */
  public set amqpId(amqpId:string) {
    this._amqpId = amqpId;
  }

  /**
   * queue topics getter
   */
  public get topics() {
    return Object.keys(this._topics);
  }

  /**
   * function to get a topic by routing key
   * @param {string} routingKey : the routing key
   * @return {Topic} the tageted topic
   */
  public getTopic(routingKey:string):Topic {
    return this._topics[routingKey];
  }

  /**
   * fonction to add consumer to a topic binded to the queue
   * if topic not already exists in the queue, it is created
   * @param {string} topic : the topic routing key
   * @param {Function} consumer : consuming function
   * @return {AMQPQueue} return current AMQPQueue object
   */
  public addConsumer(topic:string, consumer:Function):AMQPQueue {
    if (this._topics.hasOwnProperty(topic)) {
      this._topics[topic].addConsumer(consumer);
    } else {
      this._topics[topic] = new Topic([consumer]);
    }
    return this;
  }
}

/**
 * Class describing an amqp server
 */
export class AMQPServer {
  private _channel!:amqp.Channel;
  private _queues:{[key:string]:AMQPQueue}
  private _exchange:AMQPExchange
  private _amqpUrl:string
  private _name:string
  private _logger:Logger

  /**
   * AMQPServer constructor
   * @param {string} name : the server name
   * @param {string} host : amqp service host
   * @param {number} port : amqp service port
   * @param {AMQPExchange} exchange : object describing the amqp exchange
   */
  public constructor(name:string,
      host:string,
      port:number,
      exchange:AMQPExchange) {
    this._exchange = exchange;
    this._name = name;
    this._amqpUrl = `amqp://${host}:${port}`;
    this._queues = {};
    this._logger = new Logger('AMQPSERVER');
  }

  /**
   * function to connect the amqp server to the amqp service
   * and start the consuming
   */
  public run() {
    this._logger.try('Connection to AMQP Service');
    // init connection to amqp service
    amqp.connect(this._amqpUrl)
        .then((amqpConn:amqp.Connection)=> {
          this._logger.success('Connection to AMQP Service');
          this._logger.try('Create channel with AMQP Service');
          // channel creation
          return amqpConn.createChannel();
        })
        .then((amqpChanel:amqp.Channel)=> {
          this._logger.success('Create channel with AMQP Service');
          // init this._channel
          this._channel = amqpChanel;

          this._logger.try('server configuration');
          // assert the channel to service exchange
          this._channel.assertExchange(this._exchange.name,
              this._exchange.type, {
                durable: false,
              });
          // return this._channel for the rest of the processing
          return this._channel;
        })
        .then((amqpChanel:amqp.Channel)=> {
          // create the queue for each queue in conf
          Object.values(this._queues).forEach((queue:AMQPQueue) => {
            // create queue
            amqpChanel.assertQueue('',
                {exclusive: false,
                  durable: false})
                .then((amqpQueue:amqp.Replies.AssertQueue) => {
                  // update the queue object id
                  queue.amqpId = amqpQueue.queue;
                  // bind topics to queue
                  queue.topics.forEach((topic:string)=>{
                    this._channel.bindQueue(queue.amqpId,
                        this._exchange.name,
                        topic);
                  });
                  amqpChanel.consume(queue.amqpId,
                      consumeMessage,
                      {noAck: true,
                        consumerTag: queue.label});
                });
          });
        })
        .then(()=>{
          postman.on('newMessage', (message:AMQPMessage)=>{
            //extract data from amqp message headers
            const {publisher, path, report_topic, ..._headers} = message.headers;

            // eslint-disable-next-line max-len
            this._logger.info(`Message received from publisher ${publisher} on topic ${message.topic}`);

            const queue = this._queues[message.consumer];
            const topic = queue.getTopic(message.topic);
            
            const query:AMQPQuery = {
              type:"amqp",
              path : path ? path : undefined,
              topic: report_topic ? report_topic : undefined
            }

            const cPacket:ConsumerPacket = {
              body:message.body,
              headers: _headers,
              query:query,
            }

            topic.consumers.forEach((fct:Function)=>{
              fct(cPacket);
            });
          });
        }).then(()=>{
          // log success server config
          this._logger.success('server configuration');
          this._logger.info("server listening and waiting for new message")
        })
        .catch((error:Error)=>{
          // logger.failure('Configure AMQP communications');
          // logger.error(error.message);
          throw new ServerException(['SERVER', 'AMQP', 'BUILD'],
              ServerExceptionType.CONNECTION_ERROR,
              'error on amqp server',
              500);
        });
  }

  /**
   * function to create a queue and bind topics to this queue
   * @param {string} label : label of the queue
   * @return {AMQPQueue} : the created queue
   */
  public addQueue(label:string):AMQPQueue {
    const q = new AMQPQueue(label);
    this._queues[label] = q;
    return q;
  }

  /**
   * function to publish a message on amqp service
   * @param {object} body : message body
   * @param {object} headers : message header
   * @param {string} topic : topics to publish on
   */
  public publish(body:{[key:string]:string},
      headers:{[key:string]:string},
      topic?:string) {
    let _topic = undefined;
    let _headers = undefined;

    if (topic) {
      _topic = topic;
      _headers = headers;
    } else {
      // eslint-disable-next-line camelcase
      const {report_topic, ..._h} = headers;

      // eslint-disable-next-line camelcase
      _topic = report_topic;
      _headers = _h;
    }

    _headers.publisher = this._name;

    const _body = Buffer.from(JSON.stringify(body));
    const _properties = {
      headers: _headers,
      contentType: 'application/json',
    };

    this._channel.publish(
        this._exchange.name,
        <string>_topic,
        _body,
        _properties,
    );
  }
}

/**
   * function to consume the incoming message
   * @param {amqp.ConsumeMessage} message : the incomming message
   */
function consumeMessage(message:amqp.ConsumeMessage|null) {
  if (message) {
    const consumerTag = message.fields.consumerTag;
    const routingKey = message.fields.routingKey;
    const body = JSON.parse(message.content.toString());
    const headers = <AMQPHeader>message.properties.headers;

    const amqpMessage:AMQPMessage = {
      consumer: consumerTag,
      topic: routingKey,
      body: body,
      headers: headers,
    };

    postman.emit('newMessage', amqpMessage);
  }
}
