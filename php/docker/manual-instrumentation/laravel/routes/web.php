<?php

use App\Http\Controllers\DemoController;
use Illuminate\Support\Facades\Route;

Route::get('/health', [DemoController::class, 'health']);
Route::get('/ready', [DemoController::class, 'ready']);
Route::get('/', [DemoController::class, 'root']);
Route::get('/users/{userId}', [DemoController::class, 'getUser']);
Route::get('/slow', [DemoController::class, 'slow']);
Route::get('/error', [DemoController::class, 'error']);
