export class Deferred<T = any> {
  promise: Promise<T>;
  public reject!: (reason?: any) => void;
  public resolve!: (value: T | PromiseLike<T>) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}

let id: number = 1;
const callList: Map<number, Deferred> = new Map<number, Deferred>();

export class WorkerProxy {
  private worker: Worker;

  constructor(worker: Worker) {
    this.worker = worker;
    // Listen to response of the service worker
    this.worker.addEventListener(
      "message",
      (event) => {
        const { taskId, result } = event.data;
        // Check if there is a Deferred instance in workerTasks
        const task: Deferred | undefined = callList.get(taskId);

        if (task) {
          // If so resolve deferred promise and pass the returned value
          task.resolve(result);
          // delete it from the list
          callList.delete(taskId);
        }
      },
      false
    );

    // Return a Proxy so it is possible to catch all property and method or function calls of the worker
    return new Proxy(this, {
      get: (target, method: string) => {
        if (method === "worker") return target.worker; // Allow access to internal worker
        
        return function (...args: any[]) {
          const taskId = id++;

          // Post a message to service worker with UUID, method or function name of the worker and passed arguments
          target.worker.postMessage({
            taskId,
            method,
            args,
          });

          // Create a new Deferred instance and store it in workerTasks HashMap
          const deferred = new Deferred();
          callList.set(taskId, deferred);

          // Return the (currently still unresolved) Promise of the Deferred instance
          return deferred.promise;
        };
      },
    });
  }
}

export interface IVerovioWorkerProxy {
  loadData(data: string): Promise<any>;
  renderToSVG(page: number, options?: any): Promise<string>;
  renderToMIDI(): Promise<string>;
  renderToTimemap(options?: any): Promise<any>;
  getMEI(options?: any): Promise<string>;
  getPageCount(): Promise<number>;
  getElementsAtTime(time: number): Promise<any>;
  setOptions(options: any): Promise<void>;
  onRuntimeInitialized(): Promise<void>;
  getVersion(): Promise<string>;
}

export class VerovioWorkerProxy extends WorkerProxy {
  constructor(worker: Worker) {
    super(worker);
  }
}
