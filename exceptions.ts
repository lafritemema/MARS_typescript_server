import {ServerExceptionDescription} from './interfaces';
import {BaseException} from '../common';

export enum ServerExceptionType {
  CONNECTION_ERROR = 'SERVER_CONNECTION_ERROR',
  NOT_IMPLEMENTED = 'SERVER_SERVICE_NOT_IMPLEMENTED'
}

/**
 * class representing server error
 */
export class ServerException extends BaseException {
  private _errorCode:number

  /**
   * server exception constructor
   * @param {string[]} originStack : list of string describing the error origin
   * @param {ExceptionType} type : error type
   * @param {string} description : description of the error
   * @param {number} errorCode : an http error code
   */
  public constructor(originStack:string[],
      type:string,
      description:string,
      errorCode:number) {
    super(originStack, type, description);
    this._errorCode = errorCode;
  }

  /**
   * fonction to return description of error
   * @return {ServerExceptionDescription} the exception description
   */
  public describe(): ServerExceptionDescription {
    const desc = super.describe();
    return {...desc,
      code: this._errorCode,
    };
  }
}
