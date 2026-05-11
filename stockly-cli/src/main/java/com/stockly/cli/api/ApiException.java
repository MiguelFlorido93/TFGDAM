package com.stockly.cli.api;

/** Error devuelto por la API (status != 2xx) o de red. */
public class ApiException extends RuntimeException {
    private final int status;
    public ApiException(String message)             { super(message); this.status = -1; }
    public ApiException(int status, String message) { super(message); this.status = status; }
    public int status() { return status; }
}
